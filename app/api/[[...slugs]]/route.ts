import { redis } from "@/lib/redis"
import { Elysia, t } from "elysia"
import { nanoid } from "nanoid"
import {
  authMiddleware,
  identityUnknown,
  messageNotFound,
  ownershipForbidden,
} from "./auth"
import { realtime } from "@/lib/realtime"
import {
  roomIdQuerySchema,
  messagesQuerySchema,
  createMessageBodySchema,
  editMessageBodySchema,
  type Message,
  type ReadReceipt,
  type Reaction,
} from "@/lib/schemas"
import { MAX_ROOM_PARTICIPANTS, ROOM_TTL_SECONDS, pendingKeyFor } from "@/lib/room"
import { sanitizeText, sanitizeUsername } from "@/lib/sanitize"

// Message model: a HASH gives O(1) point reads/writes per message id (used
// by reactions, receipts, edits and deletes) and a ZSET keeps the transcript
// ordered by timestamp so history loads never scan or reorder data.
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
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Message
    } catch {
      return null
    }
  }
  return raw
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
  .post("/create", async () => {
    const roomId = nanoid()

    await redis.hset(`meta:${roomId}`, {
      connected: JSON.stringify([]),
      createdAt: Date.now(),
    })

    await redis.expire(`meta:${roomId}`, ROOM_TTL_SECONDS)

    return { roomId }
  })
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

      const connectedRaw = await redis.hget<string | string[]>(`meta:${roomId}`, "connected")
      const connected: string[] = Array.isArray(connectedRaw) 
        ? connectedRaw 
        : connectedRaw 
          ? JSON.parse(connectedRaw) 
          : []

      const [presenceData, usersData] = await Promise.all([
        redis.hgetall<Record<string, string | { username: string; lastSeen: number }>>(`presence:${roomId}`),
        redis.hgetall<Record<string, string>>(`users:${roomId}`),
      ])

      const now = Date.now()
      const activeTokens = new Set<string>()

      for (const token of connected) {
        const hasUser = usersData?.[token]
        if (!hasUser) continue

        const presence = presenceData?.[token]
        if (presence) {
          const parsed = typeof presence === "string" ? JSON.parse(presence) : presence
          const isActive = now - parsed.lastSeen < 60000
          if (isActive) {
            activeTokens.add(token)
          }
        } else {
          let roomCreatedAt: number
          if (typeof meta.createdAt === "string") {
            roomCreatedAt = parseInt(meta.createdAt, 10)
          } else if (typeof meta.createdAt === "number") {
            roomCreatedAt = meta.createdAt
          } else {
            roomCreatedAt = now
          }
          const roomAge = now - roomCreatedAt
          if (roomAge <= 120000) {
            activeTokens.add(token)
          }
        }
      }

      return { 
        exists: true, 
        isFull: activeTokens.size >= MAX_ROOM_PARTICIPANTS, 
        ttl: ttlNumber > 0 ? ttlNumber : 0 
      }
    },
    { query: roomIdQuerySchema }
  )
  .use(authMiddleware)
  .post(
    "/join",
    async ({ body, auth }) => {
      const username = sanitizeUsername(body.username)
      const { roomId, token } = auth
      const avatar =
        typeof body.avatar === "number" &&
        Number.isInteger(body.avatar) &&
        body.avatar >= 0 &&
        body.avatar <= 9
          ? body.avatar
          : undefined

      const remaining = await redis.ttl(`meta:${roomId}`)

      await Promise.all([
        redis.hset(`users:${roomId}`, {
          [token]: JSON.stringify({ username, avatar }),
        }),
        // The token finished its join handshake; drop its pending marker.
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
        username: t.String({ maxLength: 100 }),
        avatar: t.Optional(t.Integer({ minimum: 0, maximum: 9 })),
      }),
    }
  )
  .get(
    "/ttl",
    async ({ auth }) => {
      const ttl = await redis.ttl(`meta:${auth.roomId}`)
      return { ttl: ttl > 0 ? ttl : 0 }
    },
    { query: roomIdQuerySchema }
  )
  .delete(
    "/",
    async ({ auth }) => {
      const { roomId } = auth
      
      await realtime.channel(roomId).emit("chat.destroy", { isDestroyed: true })

      const keysToDelete = [
        `meta:${roomId}`,
        `messages:${roomId}`,
        `users:${roomId}`,
        `presence:${roomId}`,
        `history:${roomId}`,
        pendingKeyFor(roomId),
        msgKeyFor(roomId),
        msgOrderKeyFor(roomId),
      ]

      await Promise.all(keysToDelete.map((key) => redis.del(key)))
    },
    { query: roomIdQuerySchema }
  )

const messages = new Elysia({ prefix: "/messages" })
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, auth }) => {
      const sender = sanitizeUsername(body.sender)
      const text = sanitizeText(body.text)
      const avatar =
        typeof body.avatar === "number" &&
        Number.isInteger(body.avatar) &&
        body.avatar >= 0 &&
        body.avatar <= 9
          ? body.avatar
          : undefined
      const { roomId } = auth

      const message: Message = {
        id: nanoid(),
        sender,
        text,
        timestamp: Date.now(),
        roomId,
        avatar,
      }

      // HASH for O(1) point access, ZSET for timestamp ordering: reactions,
      // receipts, edits and deletes never scan the conversation.
      await Promise.all([
        redis.hset(msgKeyFor(roomId), {
          [message.id]: JSON.stringify({ ...message, token: auth.token }),
        }),
        redis.zadd(msgOrderKeyFor(roomId), {
          member: message.id,
          score: message.timestamp,
        }),
        realtime.channel(roomId).emit("chat.message", message),
      ])

      await retainRoomTtl(roomId, [msgKeyFor(roomId), msgOrderKeyFor(roomId)])

      return { success: true }
    },
    {
      query: roomIdQuerySchema,
      body: createMessageBodySchema,
    }
  )
  .post(
    "/edit",
    async ({ body, auth }) => {
      const { messageId, text } = body
      const { roomId, token } = auth

      const message = await readMessage(roomId, messageId)
      if (!message) {
        return messageNotFound()
      }

      if (message.token !== token) {
        // Explicit 403 response: scoped plugin errors do not reach this
        // router's error pipeline, and ownership must never surface as a 500.
        return ownershipForbidden()
      }
      if (message.deleted) {
        return messageNotFound()
      }

      const updatedMessage = { ...message, text: sanitizeText(text), edited: true }
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
    { query: messagesQuerySchema }
  )
  .post(
    "/reaction",
    async ({ body, auth }) => {
      const { messageId, emoji, action } = body
      const { roomId, user } = auth

      // The reacting identity is derived from the auth token, never from the
      // request body, so a client can only ever add or remove its own
      // reaction and cannot touch other people's.
      const username = user?.username
      if (!username) {
        return identityUnknown()
      }

      const message = await readMessage(roomId, messageId)
      if (!message) {
        return messageNotFound()
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
        messageId: t.String(),
        emoji: t.String(),
        action: t.Union([t.Literal("add"), t.Literal("remove")]),
      }),
    }
  )
  .post(
    "/read",
    async ({ body, auth }) => {
      const { messageId } = body
      const { roomId, user } = auth
      // Receipts are attributed to the token's identity; a body username is
      // never trusted, so no one can forge someone else's read receipt.
      const username = user?.username
      if (!username) {
        return { success: true }
      }

      const message = await readMessage(roomId, messageId)
      if (!message) {
        return messageNotFound()
      }

      const readBy = message.readBy || []

      const alreadyRead = readBy.some(
        (r: ReadReceipt) => r.username === username,
      )
      if (!alreadyRead) {
        const updatedMessage = {
          ...message,
          readBy: [...readBy, { username, timestamp: Date.now() }],
        }
        await writeMessage(roomId, updatedMessage)
        await retainRoomTtl(roomId, [msgKeyFor(roomId)])
      }

      return { success: true }
    },
    {
      query: roomIdQuerySchema,
      body: t.Object({
        messageId: t.String(),
      }),
    }
  )
  .delete(
    "/",
    async ({ query, auth }) => {
      const { messageId } = query
      const { roomId, token } = auth

      const message = await readMessage(roomId, messageId)
      if (!message) {
        return messageNotFound()
      }

      if (message.token !== token) {
        // Explicit 403 response: scoped plugin errors do not reach this
        // router's error pipeline, and ownership must never surface as a 500.
        return ownershipForbidden()
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
        messageId: t.String(),
      }),
    }
  )

const presence = new Elysia({ prefix: "/presence" })
  .use(authMiddleware)
  .post(
    "/typing",
    async ({ body, auth }) => {
      const { isTyping } = body
      const username = auth.user?.username
      if (!username) {
        return { success: true }
      }

      await realtime.channel(auth.roomId).emit("chat.typing", {
        username,
        isTyping,
      })
    },
    {
      query: roomIdQuerySchema,
      body: t.Object({
        isTyping: t.Boolean(),
      }),
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
    }
  )
  .get(
    "/",
    async ({ auth }) => {
      const presenceData = await redis.hgetall<Record<string, string | { username: string; lastSeen: number }>>(`presence:${auth.roomId}`)
      const usersData = await redis.hgetall<Record<string, string | { username: string; avatar?: number }>>(`users:${auth.roomId}`)

      const users = Object.entries(presenceData || {}).map(([token, data]) => {
        const parsed = typeof data === "string" ? JSON.parse(data) : data
        const isOnline = Date.now() - parsed.lastSeen < 60000
        let avatar: number | undefined
        if (usersData && typeof usersData[token] === "string") {
          try {
            const parsedUser = JSON.parse(usersData[token] as string)
            if (
              typeof parsedUser === "object" &&
              parsedUser !== null &&
              Number.isInteger(parsedUser.avatar) &&
              parsedUser.avatar >= 0 &&
              parsedUser.avatar <= 9
            ) {
              avatar = parsedUser.avatar
            }
          } catch {
            // Pre-avatar join data stores a plain username string.
          }
        }
        return {
          username: parsed.username,
          status: isOnline ? ("online" as const) : ("offline" as const),
          lastSeen: parsed.lastSeen,
          avatar,
        }
      })

      return { users }
    },
    { query: roomIdQuerySchema }
  )

const app = new Elysia({ prefix: "/api" }).use(rooms).use(messages).use(presence)

export const GET = app.fetch
export const POST = app.fetch
export const DELETE = app.fetch

export type App = typeof app