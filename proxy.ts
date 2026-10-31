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
      // handshake window lapses.
      const issuedAt = pendingIssuedAt.get(token)
      if (issuedAt !== undefined && now - issuedAt < JOIN_HANDSHAKE_WINDOW_MS) {
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
    const cleanedConnected = connected.filter((token: string) => !staleTokens.includes(token))
    await Promise.all([
      redis.hset(`meta:${roomId}`, {
        connected: JSON.stringify(cleanedConnected),
      }),
      redis.zrem(
        pendingKeyFor(roomId),
        staleTokens.filter((token) => pendingIssuedAt.has(token)),
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

  const updatedConnected = connected.filter((t: string) => !staleTokens.includes(t))
  const issuedAt = now
  await Promise.all([
    redis.hset(`meta:${roomId}`, {
      connected: JSON.stringify([...updatedConnected, token]),
    }),
    // Track the issuance so the staleness pass can spare connecting users.
    redis.zadd(pendingKeyFor(roomId), { score: issuedAt, member: token }),
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
