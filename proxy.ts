import { NextRequest, NextResponse } from "next/server"
import { redis } from "./lib/redis"
import { nanoid } from "nanoid"
import { pendingKeyFor } from "./lib/room"

const PRESENCE_TIMEOUT_MS = 60000
/**
 * A token issued by the proxy has this long to finish the join handshake.
 * During the window a connected-but-not-yet-joined token is kept alive
 * instead of being swept, so one user loading the room can never evict
 * another user who is still picking a name.
 */
const JOIN_HANDSHAKE_WINDOW_MS = 5 * 60_000

/**
 * Reload storms with fresh cookie jars cannot grow the pending set past
 * this cap: oldest abandoned tokens are dropped immediately rather than
 * waiting out the handshake window, so they cannot occupy room capacity.
 */
const PENDING_MAX = 10

/**
 * Registers a token in the room atomically. The connected list and the
 * pending index are written together; concurrent page loads cannot lose
 * each other's tokens to a read-modify-write race, and an over-cap
 * pending set trims its oldest members (also dropping them from
 * connected so they release their slot at once).
 */
const ADD_TOKEN_SCRIPT = `local raw = redis.call('HGET', KEYS[1], 'connected')
local list = raw and cjson.decode(raw) or {}
local exists = false
for _, t in ipairs(list) do
  if t == ARGV[1] then exists = true end
end
if not exists then
  table.insert(list, ARGV[1])
  redis.call('HSET', KEYS[1], 'connected', cjson.encode(list))
end
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[1])
local pending = redis.call('ZCARD', KEYS[2])
local over = pending - tonumber(ARGV[3])
if over > 0 then
  local dropped = redis.call('ZRANGEBYRANK', KEYS[2], 0, over - 1)
  redis.call('ZREMRANGEBYRANK', KEYS[2], 0, over - 1)
  if #dropped > 0 then
    local kept = {}
    for _, t in ipairs(list) do
      local isDropped = false
      for _, d in ipairs(dropped) do
        if t == d then isDropped = true end
      end
      if not isDropped then table.insert(kept, t) end
    end
    list = kept
    redis.call('HSET', KEYS[1], 'connected', cjson.encode(list))
  end
end
return cjson.encode(list)`

/**
 * Removes stale (unresponsive or past-handshake) tokens from the room
 * atomically: connected, the pending index, and the joined-user/presence
 * entries all go together, so swept tokens cannot linger as phantom
 * capacity and block later joins.
 */
const SWEEP_TOKENS_SCRIPT = `local raw = redis.call('HGET', KEYS[1], 'connected')
if not raw then return 0 end
local list = cjson.decode(raw)
local stale = {}
for _, t in ipairs(ARGV) do stale[t] = true end
local kept = {}
for _, t in ipairs(list) do
  if not stale[t] then table.insert(kept, t) end
end
redis.call('HSET', KEYS[1], 'connected', cjson.encode(kept))
redis.call('ZREM', KEYS[2], unpack(ARGV))
for _, key in ipairs({ KEYS[3], KEYS[4] }) do
  local removed = redis.call('HDEL', key, unpack(ARGV))
end
if #kept == 0 then
  redis.call('HSET', KEYS[1], 'connected', '[]')
end
return 1`

export const proxy = async (req: NextRequest) => {
  const pathname = req.nextUrl.pathname

  const roomMatch = pathname.match(/^\/room\/([^/]+)$/)
  if (!roomMatch) return NextResponse.redirect(new URL("/", req.url))

  const roomId = roomMatch[1]

  const meta = await redis.hgetall<{ connected: string | string[]; createdAt: string | number }>(
    `meta:${roomId}`
  )

  if (!meta) {
    return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
  }

  const connected: string[] = Array.isArray(meta.connected)
    ? meta.connected
    : typeof meta.connected === "string"
      ? JSON.parse(meta.connected)
      : []

  const [presenceData, usersData, pendingData] = await Promise.all([
    redis.hgetall<Record<string, string | { username: string; lastSeen: number }>>(`presence:${roomId}`),
    redis.hgetall<Record<string, string>>(`users:${roomId}`),
    // This client version returns a flat alternating array: member, score, member, score, ...
    redis.zrange<Array<string | number>>(pendingKeyFor(roomId), 0, -1, { withScores: true }),
  ])

  const pendingIssuedAt = new Map<string, number>()
  for (let i = 0; i + 1 < pendingData.length; i += 2) {
    pendingIssuedAt.set(String(pendingData[i]), Number(pendingData[i + 1]))
  }

  const existingToken = req.cookies.get("x-auth-token")?.value

  if (existingToken && connected.includes(existingToken) && usersData?.[existingToken]) {
    return NextResponse.next()
  }

  const now = Date.now()
  const activeTokens = new Set<string>()
  const staleTokens: string[] = []

  for (const token of connected) {
    const hasUser = usersData?.[token]

    if (!hasUser) {
      // Freshly issued tokens are still connecting; sweep only once the
      // handshake window lapses. An over-cap pending set is trimmed at
      // issue time, so nothing lingers past its own cap either.
      const issuedAt = pendingIssuedAt.get(token)
      if (issuedAt !== undefined && issuedAt >= 0 && now - issuedAt < JOIN_HANDSHAKE_WINDOW_MS) {
        activeTokens.add(token)
      } else {
        staleTokens.push(token)
      }
      continue
    }

    const presence = presenceData?.[token]
    if (presence) {
      const parsed = typeof presence === "string" ? JSON.parse(presence) : presence
      const isActive = now - parsed.lastSeen < PRESENCE_TIMEOUT_MS
      if (isActive) {
        activeTokens.add(token)
      } else {
        staleTokens.push(token)
      }
    } else {
      const roomCreatedAt = typeof meta.createdAt === "string" ? parseInt(meta.createdAt) : meta.createdAt
      const roomAge = now - (roomCreatedAt || now)
      if (roomAge > PRESENCE_TIMEOUT_MS * 2) {
        staleTokens.push(token)
      } else {
        activeTokens.add(token)
      }
    }
  }

  const remaining = await redis.ttl(`meta:${roomId}`)

  if (staleTokens.length > 0) {
    await Promise.all([
      redis.eval(
        SWEEP_TOKENS_SCRIPT,
        [`meta:${roomId}`, pendingKeyFor(roomId), `users:${roomId}`, `presence:${roomId}`],
        staleTokens,
      ),
      remaining > 0 ? redis.expire(`meta:${roomId}`, remaining) : Promise.resolve(),
    ])
  }

  if (activeTokens.size >= 2) {
    return NextResponse.redirect(new URL("/?error=room-full", req.url))
  }

  const response = NextResponse.next()

  const token = nanoid()

  response.cookies.set("x-auth-token", token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  })

  const issuedAt = now
  await Promise.all([
    redis.eval(
      ADD_TOKEN_SCRIPT,
      [`meta:${roomId}`, pendingKeyFor(roomId)],
      [token, String(issuedAt), String(PENDING_MAX)],
    ),
    remaining > 0
      ? Promise.all([
          redis.expire(`meta:${roomId}`, remaining),
          redis.expire(pendingKeyFor(roomId), remaining),
        ])
      : Promise.resolve(),
  ])

  return response
}

export const config = {
  matcher: "/room/:path*",
}
