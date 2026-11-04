import { redis } from "@/lib/redis"
import { rate } from "@/lib/rate-limiter"
import { Elysia, t } from "elysia"
import { nanoid } from "nanoid"
import {
  authMiddleware,
  identityUnknown,
  messageNotFound,
  ownershipForbidden,
  tooManyRequests,
  emptyMessage,
  emptyUsername,
  editWindowClosed,
  roomFull,
  nameTaken,
  floodGate,
} from "./auth"
import { realtime } from "@/lib/realtime"
import {
  roomIdQuerySchema,
  messagesQuerySchema,
  createMessageBodySchema,
  editMessageBodySchema,
  messageSchema,
  type Message,
  type Reaction,
} from "@/lib/schemas"
import {
  parsePresence,
  parseUserRecord,
  safeJsonParse,
  toFiniteNumber,
  toStringArray,
} from "@/lib/parse"
import {
  DEFAULT_ROOM_DURATION,
  EDIT_WINDOW_MS,
  MAX_ROOM_PARTICIPANTS,
  pendingKeyFor,
  roomDurationSeconds,
} from "@/lib/room"
import { sanitizeText, sanitizeUsername } from "@/lib/sanitize"
import { createLogger, logger } from "@/lib/logger"

const log = createLogger("api")

/**
 * Uniform error body shared by every failure path, so Eden infers a single
 * `{ error: string }` shape for all non-2xx statuses on the client.
 */
const errorBody = t.Object({ error: t.String() })

/** Declared failures for token-gated routes; success schemas are per route. */
const authedErrors = {
  401: errorBody,
  429: errorBody,
}

// Elysia's t.Optional only wraps native schemas; this mirrors the zod
// roomDurationSchema set (pinned together by tests/schemas.test.ts).
const createRoomBody = t.Optional(
  t.Object({
    duration: t.Optional(
      t.Union([t.Literal("15m"), t.Literal("1h"), t.Literal("24h")]),
    ),
  }),
)

/**
 * Response shape for a stored message. Declaring it (instead of returning
 * `t.Unknown`) keeps Eden's inferred type aligned with the zod `Message`, so
 * the client gets real checking on every field the transcript renders.
 */
const messageResponse = t.Object({
  id: t.String(),
  sender: t.String(),
  text: t.String(),
  timestamp: t.Number(),
  roomId: t.String(),
  token: t.Optional(t.String()),
  avatar: t.Optional(t.Number()),
  reactions: t.Optional(
    t.Array(
      t.Object({
        emoji: t.String(),
        username: t.String(),
        timestamp: t.Number(),
      }),
    ),
  ),
  readBy: t.Optional(
    t.Array(t.Object({ username: t.String(), timestamp: t.Number() })),
  ),
  edited: t.Optional(t.Boolean()),
  deleted: t.Optional(t.Boolean()),
})

/** Message model: a HASH gives O(1) point reads/writes per message id (used
// by reactions, receipts, edits and deletes) and a ZSET keeps the transcript
// ordered by timestamp so history loads never scan or reorder data.
 */
const msgKeyFor = (roomId: string) => `msg:${roomId}`
const msgOrderKeyFor = (roomId: string) => `order:${roomId}`

/**
 * The Upstash client auto-deserializes valid JSON payloads, so a stored
 * message may arrive as either its raw JSON string or an already-parsed
 * object depending on which client version wrote it.
 */
type StoredMessage = string | Message | null

function parseStoredMessage(raw: StoredMessage): Message | null {
  if (raw === null || raw === undefined) return null
  const parsed = typeof raw === "string" ? safeJsonParse<unknown>(raw) : raw
  // Validate at the storage boundary: a corrupted or hand-edited hash value
  // must degrade to "missing message", never flow into the transcript as a
  // half-shaped object the client assumes is a Message.
  const result = messageSchema.safeParse(parsed)
  return result.success ? result.data : null
}

async function readMessage(roomId: string, messageId: string): Promise<Message | null> {
  const raw = await redis.hget<StoredMessage>(msgKeyFor(roomId), messageId)
  return parseStoredMessage(raw)
}

async function writeMessage(roomId: string, message: Message): Promise<void> {
  await redis.hset(msgKeyFor(roomId), { [message.id]: JSON.stringify(message) })
}

/** Keeps room keys on the room's remaining lifetime. */
async function retainRoomTtl(roomId: string, keys: string[]): Promise<void> {
  const remaining = await redis.ttl(`meta:${roomId}`)
  if (remaining > 0) {
    await Promise.all(keys.map((key) => redis.expire(key, remaining)))
  }
}

const rooms = new Elysia({ prefix: "/room" })
  .post(
    "/create",
    async ({ body, request, set }) => {
      rate.init()

      const CREATE_WINDOW_MS = 60_000
      const CREATE_PER_IP_MAX = 5
      const CREATE_GLOBAL_MAX = 120

      const getIp = (req: Request): string => {
        const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        const real = req.headers.get("x-real-ip")?.trim()
        return (forwarded || real || "local").slice(0, 64)
      }

      const { blocked: ipBlocked } = await rate.hit(
        `rate:ip:${getIp(request)}`,
        CREATE_WINDOW_MS,
        CREATE_PER_IP_MAX,
      )

      if (ipBlocked) {
        log.warn("Room create rate limited per-IP", { ip: getIp(request) })
        return tooManyRequests(set)
      }

      const { blocked: globalBlocked } = await rate.hit(
        "rate:global",
        CREATE_WINDOW_MS,
        CREATE_GLOBAL_MAX,
      )

      if (globalBlocked) {
        log.warn("Room create rate limited globally")
        return tooManyRequests(set)
      }

      const roomId = nanoid()
      const duration = body?.duration
      const ttlSeconds = roomDurationSeconds(duration)

      // One pipeline instead of two sequential round-trips to the REST edge;
      // room creation is on the first-interaction critical path.
      const setup = redis.pipeline()
      setup.hset(`meta:${roomId}`, {
        connected: JSON.stringify([]),
        createdAt: Date.now(),
      })
      setup.expire(`meta:${roomId}`, ttlSeconds)
      await setup.exec()

      log.info("Room created", { roomId, ip: getIp(request), duration: duration ?? DEFAULT_ROOM_DURATION })

      return { roomId }
    },
    {
      body: createRoomBody,
      response: { ...authedErrors, 200: t.Object({ roomId: t.String() }) },
    }
  )
  .get(
    "/check",
    async ({ query }) => {
      const { roomId } = query
      
      const meta = await redis.hgetall(`meta:${roomId}`)
      const ttl = await redis.ttl(`meta:${roomId}`)
      const ttlNumber = typeof ttl === "number" ? ttl : 0
      
      if (!meta || ttlNumber <= 0) {
        return { exists: false, isFull: false, ttl: 0 }
      }

      const connectedRaw = await redis.hget<unknown>(`meta:${roomId}`, "connected")
      const connected: string[] = toStringArray(connectedRaw)

      const [presenceData, usersData] = await Promise.all([
        redis.hgetall<Record<string, unknown>>(`presence:${roomId}`),
        redis.hgetall<Record<string, unknown>>(`users:${roomId}`),
      ])

      const now = Date.now()
      const roomCreatedAt = toFiniteNumber(meta.createdAt, now)
      const activeTokens = new Set<string>()

      for (const token of connected) {
        if (!usersData?.[token]) continue

        const presence = parsePresence(presenceData?.[token])
        if (presence) {
          if (now - presence.lastSeen < 60_000) activeTokens.add(token)
        } else if (now - roomCreatedAt <= 120_000) {
          // No heartbeat yet: a just-joined token is active for the same
          // grace period the proxy grants a fresh handshake.
          activeTokens.add(token)
        }
      }

      return { 
        exists: true, 
        isFull: activeTokens.size >= MAX_ROOM_PARTICIPANTS, 
        ttl: ttlNumber > 0 ? ttlNumber : 0 
      }
    },
    {
      query: roomIdQuerySchema,
      response: {
        200: t.Object({ exists: t.Boolean(), isFull: t.Boolean(), ttl: t.Number() }),
      },
    }
  )
  .use(authMiddleware)
  .post(
    "/join",
    async ({ body, auth, set }) => {
      const username = sanitizeUsername(body.username).slice(0, 24)
      const { roomId, token } = auth
      const avatar =
        typeof body.avatar === "number" &&
        Number.isInteger(body.avatar) &&
        body.avatar >= 0 &&
        body.avatar <= 9
          ? body.avatar
          : undefined

      if (!username || username.trim().length === 0) {
        return emptyUsername(set)
      }

      // One atomic decision: capacity (joined participants, not page loads),
      // re-join passthrough, and username uniqueness, so two parallel joins
      // cannot both squeeze a colliding name in. Names compare
      // case-insensitively and cover the pre-avatar plain-string format, so
      // a new joiner cannot impersonate an existing participant by case or
      // by relying on legacy storage.
      const decision = await redis.eval<unknown[], number>(
        `local exists = redis.call('HEXISTS', KEYS[1], ARGV[1])
if exists == 1 then return 1 end
if tonumber(redis.call('HLEN', KEYS[1])) >= tonumber(ARGV[2]) then return 0 end
local target = string.lower(ARGV[3])
local vals = redis.call('HVALS', KEYS[1])
for _, v in ipairs(vals) do
  local ok, decoded = pcall(function() return cjson.decode(v) end)
  local name = nil
  if ok and type(decoded) == 'table' then
    name = decoded.username
  elseif type(v) == 'string' then
    name = v
  end
  if type(name) == 'string' and string.lower(name) == target then return -1 end
end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[4])
return 1`,
        [`users:${roomId}`],
        [token, String(MAX_ROOM_PARTICIPANTS), username, JSON.stringify({ username, avatar })],
      )

      if (decision === 0) {
        log.warn("Join rejected: room full", { roomId, username })
        return roomFull(set)
      }
      if (decision === -1) {
        log.warn("Join rejected: name taken", { roomId, username })
        return nameTaken(set)
      }

      const remaining = await redis.ttl(`meta:${roomId}`)

      log.info("User joined", { roomId, username })

      await Promise.all([
        redis.zrem(pendingKeyFor(roomId), token),
        remaining > 0 ? redis.expire(`users:${roomId}`, remaining) : Promise.resolve(),
        realtime.channel(roomId).emit("chat.connection", {
          username,
          action: "joined",
          timestamp: Date.now(),
          avatar,
        }),
      ])

      return { success: true }
    },
    {
      query: roomIdQuerySchema,
      body: t.Object({
        username: t.String({ minLength: 1, maxLength: 24 }),
        avatar: t.Optional(t.Integer({ minimum: 0, maximum: 9 })),
      }),
      response: {
        ...authedErrors,
        200: t.Object({ success: t.Literal(true) }),
        403: errorBody,
        409: errorBody,
      },
    }
  )
  .get(
    "/ttl",
    async ({ auth }) => {
      const ttl = await redis.ttl(`meta:${auth.roomId}`)
      return { ttl: ttl > 0 ? ttl : 0 }
    },
    {
      query: roomIdQuerySchema,
      response: { ...authedErrors, 200: t.Object({ ttl: t.Number() }) },
    }
  )
  .delete(
    "/",
    async ({ auth }) => {
      const { roomId } = auth
      
      await realtime.channel(roomId).emit("chat.destroy", { isDestroyed: true })

      const keysToDelete = [
        `meta:${roomId}`,
        `users:${roomId}`,
        `presence:${roomId}`,
        pendingKeyFor(roomId),
        msgKeyFor(roomId),
        msgOrderKeyFor(roomId),
      ]

      await Promise.all(keysToDelete.map((key) => redis.del(key)))

      log.info("Room destroyed", { roomId, username: auth.user?.username })

      return { success: true }
    },
    {
      query: roomIdQuerySchema,
      response: { ...authedErrors, 200: t.Object({ success: t.Literal(true) }) },
    }
  )

const messages = new Elysia({ prefix: "/messages" })
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, auth, set }) => {
      // Identity is server-only: the body's historical sender/avatar fields
      // were removed, so a client cannot post as another participant.
      const username = auth.user?.username
      if (!username) {
        return identityUnknown(set)
      }
      const text = sanitizeText(body.text)
      if (!text) {
        return emptyMessage(set)
      }
      const { roomId } = auth

      // Flood control: a fixed window keyed on the auth token, so a runaway
      // or malicious client cannot blanket Redis with messages.
      if (!(await floodGate(roomId, auth.token, "msg", 8, 5))) {
        log.warn("Message flood gate tripped", { roomId, username })
        return tooManyRequests(set)
      }

      const message: Message = {
        id: nanoid(),
        sender: username,
        text,
        timestamp: Date.now(),
        roomId,
        avatar: auth.user?.avatar,
      }

      // HASH for O(1) point access, ZSET for timestamp ordering: reactions,
      // receipts, edits and deletes never scan the conversation. The TTL
      // read rides the same pipeline, so sustaining the room's lifetime is
      // one extra round-trip after a one round-trip write instead of a
      // sequential chain.
      const emitMessage = realtime.channel(roomId).emit("chat.message", message)

      const persist = redis.pipeline()
      persist.hset(msgKeyFor(roomId), {
        [message.id]: JSON.stringify({ ...message, token: auth.token }),
      })
      persist.zadd(msgOrderKeyFor(roomId), {
        member: message.id,
        score: message.timestamp,
      })
      persist.ttl(`meta:${roomId}`)
      const results = (await persist.exec()) as unknown[]
      const remainingTtl = Number(results[2])

      if (remainingTtl > 0) {
        // Parallel expirations; the room's remaining lifetime is shared by
        // both transcript keys so they die with the room.
        await Promise.all([
          redis.expire(msgKeyFor(roomId), remainingTtl),
          redis.expire(msgOrderKeyFor(roomId), remainingTtl),
        ])
      }

      await emitMessage

      return { success: true }
    },
    {
      query: roomIdQuerySchema,
      body: createMessageBodySchema,
      response: {
        ...authedErrors,
        200: t.Object({ success: t.Literal(true) }),
        422: errorBody,
      },
    }
  )
  .post(
    "/edit",
    async ({ body, auth, set }) => {
      const { messageId } = body
      const { roomId, token } = auth

      const message = await readMessage(roomId, messageId)
      if (!message) {
        return messageNotFound(set)
      }

      if (message.token !== token) {
        // Explicit 403 response: scoped plugin errors do not reach this
        // router's error pipeline, and ownership must never surface as a 500.
        return ownershipForbidden(set)
      }
      if (message.deleted) {
        return messageNotFound(set)
      }
      if (Date.now() - message.timestamp > EDIT_WINDOW_MS) {
        log.warn("Edit rejected: window closed", { roomId, messageId, ageMs: Date.now() - message.timestamp })
        return editWindowClosed(set)
      }

      const text = sanitizeText(body.text)
      if (!text) {
        return emptyMessage(set)
      }

      const updatedMessage = { ...message, text, edited: true }
      await writeMessage(roomId, updatedMessage)

      await Promise.all([
        realtime.channel(roomId).emit("chat.edited", {
          messageId,
          text: updatedMessage.text,
          editedAt: Date.now(),
        }),
        retainRoomTtl(roomId, [msgKeyFor(roomId)]),
      ])

      return { success: true }
    },
    {
      query: roomIdQuerySchema,
      body: editMessageBodySchema,
      response: {
        ...authedErrors,
        200: t.Object({ success: t.Literal(true) }),
        403: errorBody,
        404: errorBody,
        422: errorBody,
      },
    }
  )
  .get(
    "/",
    async ({ auth, query }) => {
      const { roomId, token } = auth
      const { before, limit } = query
      const pageSize = limit ?? 100

      // Newest-first page of ids: from the exclusive cursor when paging
      // back, or the top of the transcript for the initial load.
      const start: `(${number}` | "+inf" =
        before !== undefined ? `(${before}` : "+inf"
      const ids = await redis.zrange<string[]>(
        msgOrderKeyFor(roomId),
        start,
        "-inf",
        { byScore: true, rev: true, offset: 0, count: pageSize + 1 },
      )

      const hasMore = ids.length > pageSize
      const pageIds = ids.slice(0, pageSize)

      if (pageIds.length === 0) {
        return { messages: [], hasMore }
      }

      const stored = await redis.hmget<Record<string, StoredMessage>>(
        msgKeyFor(roomId),
        ...(pageIds as string[]),
      )

      const byId = new Map(Object.entries(stored ?? {}))
      const messages = pageIds
        .map((id) => parseStoredMessage((byId.get(id) ?? null) as StoredMessage))
        .filter((message): message is Message => message !== null)
        .map((message) => ({
          ...message,
          token: message.token === token ? token : undefined,
        }))
        // The page walks newest-first; the transcript renders oldest-first.
        .reverse()

      return { messages, hasMore }
    },
    {
      query: messagesQuerySchema,
      response: {
        ...authedErrors,
        200: t.Object({
          messages: t.Array(messageResponse),
          hasMore: t.Boolean(),
        }),
        422: errorBody,
      },
    }
  )
  .post(
    "/reaction",
    async ({ body, auth, set }) => {
      const { messageId, emoji, action } = body
      const { roomId, user } = auth

      // The reacting identity is derived from the auth token, never from the
      // request body, so a client can only ever add or remove its own
      // reaction and cannot touch other people's.
      const username = user?.username
      if (!username) {
        return identityUnknown(set)
      }

      // Reactions are O(1) writes that also bloom the message JSON; a
      // scripted client hammering this endpoint needs the same containment
      // messages have.
      if (!(await floodGate(roomId, auth.token, "react", 12, 5))) {
        log.warn("Reaction flood gate tripped", { roomId, username })
        return tooManyRequests(set)
      }

      const message = await readMessage(roomId, messageId)
      if (!message) {
        return messageNotFound(set)
      }

      // Invariant: one reaction per user per message. "add" replaces any
      // emoji they previously chose; "remove" is idempotent. Last write
      // wins when two people race; neither can corrupt the other's entry.
      const reactionsWithoutMine = (message.reactions || []).filter(
        (r: Reaction) => r.username !== username,
      )
      const updatedReactions =
        action === "add"
          ? [...reactionsWithoutMine, { emoji, username, timestamp: Date.now() }]
          : reactionsWithoutMine

      const updatedMessage = { ...message, reactions: updatedReactions }
      await writeMessage(roomId, updatedMessage)

      await Promise.all([
        realtime
          .channel(roomId)
          .emit("chat.reaction", { messageId, reactions: updatedReactions }),
        retainRoomTtl(roomId, [msgKeyFor(roomId), msgOrderKeyFor(roomId)]),
      ])

      return { success: true }
    },
    {
      query: roomIdQuerySchema,
      body: t.Object({
        messageId: t.String({ maxLength: 64 }),
        // A reaction chip is a grapheme cluster; anything past this is
        // payload stuffing, not an emoji.
        emoji: t.String({ minLength: 1, maxLength: 16 }),
        action: t.Union([t.Literal("add"), t.Literal("remove")]),
      }),
      response: {
        ...authedErrors,
        200: t.Object({ success: t.Literal(true) }),
        404: errorBody,
        422: errorBody,
      },
    }
  )
  .post(
    "/read",
    async ({ body, auth, set }) => {
      const { messageIds } = body
      const { roomId, user } = auth
      // Receipts are attributed to the token's identity; a body username is
      // never trusted, so no one can forge someone else's read receipt.
      const username = user?.username
      if (!username) {
        return { success: true }
      }

      // Receipts rewrite message JSON; a scroll burst legitimately sends a
      // few batches, but a scripted client must not turn that into an
      // unbounded write amplifier.
      if (!(await floodGate(roomId, auth.token, "read", 60, 5))) {
        return tooManyRequests(set)
      }

      // One EVAL covers the whole batch: an HGET + conditional HSET per
      // message would be 2N round-trips to a Upstash REST edge, turning a
      // single scroll burst into a cascade of sequential HTTP requests. In
      // the script the read-modify-write cycle is also atomic, so two
      // concurrent batches for one user can never double-append a receipt.
      // Missing ids (deleted between fetch and receipt) are skipped without
      // failing the batch. KEYS[1] is the message hash; ARGV[1..2] carry
      // the username and timestamp, ARGV[3..] the message ids.
      const mutated = await redis.eval<unknown[], number>(
        `local msgKey = KEYS[1]
local username = ARGV[1]
local readAt = tonumber(ARGV[2])
local mutated = 0
for i = 3, #ARGV do
  local raw = redis.call('HGET', msgKey, ARGV[i])
  if raw then
    local ok, message = pcall(function() return cjson.decode(raw) end)
    if ok and type(message) == 'table' then
      local already = false
      if message.readBy then
        for _, receipt in ipairs(message.readBy) do
          if receipt.username == username then
            already = true
            break
          end
        end
      end
      if not already then
        if message.readBy == nil then message.readBy = {} end
        table.insert(message.readBy, { username = username, timestamp = readAt })
        redis.call('HSET', msgKey, ARGV[i], cjson.encode(message))
        mutated = mutated + 1
      end
    end
end
if mutated > 0 then
  local remaining = redis.call('TTL', msgKey)
  if remaining > 0 then redis.call('EXPIRE', msgKey, remaining) end
end
return mutated`,
        [msgKeyFor(roomId)],
        [username, String(Date.now()), ...messageIds],
      )

      log.debug("Read receipts applied", {
        roomId,
        requested: messageIds.length,
        mutated: Number(mutated),
      })

      return { success: true }
    },
    {
      query: roomIdQuerySchema,
      body: t.Object({
        // One batch receipt per typing/scroll burst; 50 is well above what an
        // intersection observer can queue in a single frame.
        messageIds: t.Array(t.String({ maxLength: 64 }), { maxItems: 50, minItems: 1 }),
      }),
      response: {
        ...authedErrors,
        200: t.Object({ success: t.Literal(true) }),
      },
    }
  )
  .delete(
    "/",
    async ({ query, auth, set }) => {
      const { messageId } = query
      const { roomId, token } = auth

      const message = await readMessage(roomId, messageId)
      if (!message) {
        return messageNotFound(set)
      }

      if (message.token !== token) {
        // Explicit 403 response: scoped plugin errors do not reach this
        // router's error pipeline, and ownership must never surface as a 500.
        return ownershipForbidden(set)
      }

      const deletedMessage = { ...message, deleted: true, text: "" }
      await writeMessage(roomId, deletedMessage)

      // The stored copy keeps the owner token, but broadcasts must not leak
      // it to other participants.
      await Promise.all([
        realtime
          .channel(roomId)
          .emit("chat.message", { ...deletedMessage, token: undefined }),
        retainRoomTtl(roomId, [msgKeyFor(roomId), msgOrderKeyFor(roomId)]),
      ])

      return { success: true }
    },
    {
      query: t.Object({
        roomId: t.String(),
        messageId: t.String({ maxLength: 64 }),
      }),
      response: {
        ...authedErrors,
        200: t.Object({ success: t.Literal(true) }),
        403: errorBody,
        404: errorBody,
      },
    }
  )

const presence = new Elysia({ prefix: "/presence" })
  .use(authMiddleware)
  .post(
    "/typing",
    async ({ body, auth, set }) => {
      const { isTyping } = body
      const username = auth.user?.username
      if (!username) {
        return { success: true }
      }

      // Typing is the cheapest amplification surface: one request fans out
      // to every participant. Cap it so a scripted client cannot turn the
      // channel into a notification firehose.
      if (!(await floodGate(auth.roomId, auth.token, "typing", 20, 5))) {
        return tooManyRequests(set)
      }

      await realtime.channel(auth.roomId).emit("chat.typing", {
        username,
        isTyping,
      })

      return { success: true }
    },
    {
      query: roomIdQuerySchema,
      body: t.Object({
        isTyping: t.Boolean(),
      }),
      response: {
        ...authedErrors,
        200: t.Object({ success: t.Literal(true) }),
      },
    }
  )
  .post(
    "/heartbeat",
    async ({ auth }) => {
      const username = auth.user?.username
      if (!username) {
        return { success: true }
      }

      const now = Date.now()
      // Read once; the same value returns to the client so the countdown
      // there stays server-locked without a second polling endpoint.
      const remaining = await redis.ttl(`meta:${auth.roomId}`)

      await Promise.all([
        redis.hset(`presence:${auth.roomId}`, {
          [auth.token]: JSON.stringify({ username, lastSeen: now }),
        }),
        remaining > 0 ? redis.expire(`presence:${auth.roomId}`, remaining) : Promise.resolve(),
        realtime.channel(auth.roomId).emit("chat.presence", {
          username,
          status: "online",
          lastSeen: now,
        }),
      ])

      return { success: true, ttl: remaining > 0 ? remaining : 0 }
    },
    {
      query: roomIdQuerySchema,
      response: {
        ...authedErrors,
        200: t.Union([
          t.Object({ success: t.Literal(true), ttl: t.Number() }),
          t.Object({ success: t.Literal(true) }),
        ]),
      },
    }
  )
  .get(
    "/",
    async ({ auth }) => {
      const [presenceData, usersData] = await Promise.all([
        redis.hgetall<Record<string, unknown>>(`presence:${auth.roomId}`),
        redis.hgetall<Record<string, unknown>>(`users:${auth.roomId}`),
      ])

      const now = Date.now()
      const users = Object.entries(presenceData ?? {}).flatMap(
        ([token, data]) => {
          const parsed = parsePresence(data)
          if (!parsed) return []

          const storedUser = parseUserRecord(usersData?.[token])
          const avatar = storedUser?.avatar

          return [
            {
              username: parsed.username,
              status:
                now - parsed.lastSeen < 60_000
                  ? ("online" as const)
                  : ("offline" as const),
              lastSeen: parsed.lastSeen,
              avatar,
            },
          ]
        },
      )

      return { users }
    },
    {
      query: roomIdQuerySchema,
      response: {
        ...authedErrors,
        200: t.Object({
          users: t.Array(
            t.Object({
              username: t.String(),
              status: t.Union([t.Literal("online"), t.Literal("offline")]),
              lastSeen: t.Number(),
              avatar: t.Optional(t.Number()),
            }),
          ),
        }),
      },
    }
  )

const app = new Elysia({ prefix: "/api" })
  .use(rooms)
  .use(messages)
  .use(presence)
  // Anything that escapes a route surfaces as a 500 here: this is the only
  // place the stack survives, so every unhandled failure finds the log
  // instead of dying silently.
  .onError({ as: "global" }, ({ code, error, path }) => {
    if (code === "VALIDATION") {
      logger.warn("Request validation failed", { path })
      return
    }
    if (code === "AuthError" || code === "CrossOriginError") {
      return
    }
    logger.error("Unhandled route failure", {
      path,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
  })

export const GET = app.fetch
export const POST = app.fetch
export const DELETE = app.fetch

export type App = typeof app