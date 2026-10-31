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
  createMessageBodySchema,
  editMessageBodySchema,
  type Message,
  type ReadReceipt,
  type Reaction,
} from "@/lib/schemas"
import { MAX_ROOM_PARTICIPANTS, ROOM_TTL_SECONDS, pendingKeyFor } from "@/lib/room"
import { sanitizeText, sanitizeUsername } from "@/lib/sanitize"

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

      const messageWithToken = JSON.stringify({ ...message, token: auth.token })

      await Promise.all([
        redis.rpush(`messages:${roomId}`, messageWithToken),
        realtime.channel(roomId).emit("chat.message", message),
      ])

      const remaining = await redis.ttl(`meta:${roomId}`)
      if (remaining > 0) {
        await redis.expire(`messages:${roomId}`, remaining)
      }
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

      const messages = await redis.lrange<string>(`messages:${roomId}`, 0, -1)
      const messageIndex = messages.findIndex((m) => {
        const parsed = typeof m === "string" ? JSON.parse(m) : m
        return parsed.id === messageId
      })

      if (messageIndex === -1) {
        return messageNotFound()
      }

      const messageStr = messages[messageIndex]
      const message = typeof messageStr === "string" ? JSON.parse(messageStr) : messageStr
      if (message.token !== token) {
        // Explicit 403 response: scoped plugin errors do not reach this
        // router's error pipeline, and ownership must never surface as a 500.
        return ownershipForbidden()
      }
      if (message.deleted) {
        throw new Error("Message deleted")
      }

      const updatedMessage = { ...message, text: sanitizeText(text), edited: true }
      await redis.lset(`messages:${roomId}`, messageIndex, JSON.stringify(updatedMessage))

      await Promise.all([
        realtime.channel(roomId).emit("chat.edited", {
          messageId,
          text: updatedMessage.text,
          editedAt: Date.now(),
        }),
        (async () => {
          const remaining = await redis.ttl(`meta:${roomId}`)
          if (remaining > 0) {
            await redis.expire(`messages:${roomId}`, remaining)
          }
        })(),
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
    async ({ auth }) => {
      const messages = await redis.lrange<string>(`messages:${auth.roomId}`, 0, -1)

      return {
        messages: messages.map((m) => {
          const parsed = typeof m === "string" ? JSON.parse(m) : m
          return {
            ...parsed,
            token: parsed.token === auth.token ? auth.token : undefined,
          }
        }),
      }
    },
    { query: roomIdQuerySchema }
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

      const messages = await redis.lrange<string>(`messages:${roomId}`, 0, -1)
      const messageIndex = messages.findIndex((m) => {
        const parsed = typeof m === "string" ? JSON.parse(m) : m
        return parsed.id === messageId
      })

      if (messageIndex === -1) {
        return messageNotFound()
      }

      const messageStr = messages[messageIndex]
      const message = typeof messageStr === "string" ? JSON.parse(messageStr) : messageStr
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
      const updatedMessageStr = JSON.stringify(updatedMessage)

      await Promise.all([
        redis.lset(`messages:${roomId}`, messageIndex, updatedMessageStr),
        realtime
          .channel(roomId)
          .emit("chat.reaction", { messageId, reactions: updatedReactions }),
      ])

      const remaining = await redis.ttl(`meta:${roomId}`)
      if (remaining > 0) {
        await redis.expire(`messages:${roomId}`, remaining)
      }

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

      const messages = await redis.lrange<string>(`messages:${roomId}`, 0, -1)
      const messageIndex = messages.findIndex((m) => {
        const parsed = typeof m === "string" ? JSON.parse(m) : m
        return parsed.id === messageId
      })

      if (messageIndex === -1) {
        return messageNotFound()
      }

      const messageStr = messages[messageIndex]
      const message: Message = typeof messageStr === "string" ? JSON.parse(messageStr) : messageStr
      const readBy = message.readBy || []
      
      const alreadyRead = readBy.some(
        (r: ReadReceipt) => r.username === username,
      )
      if (!alreadyRead) {
        const updatedReadBy = [
          ...readBy,
          { username, timestamp: Date.now() },
        ]
        const updatedMessage = { ...message, readBy: updatedReadBy }
        await redis.lset(`messages:${roomId}`, messageIndex, JSON.stringify(updatedMessage))

        const remaining = await redis.ttl(`meta:${roomId}`)
        await redis.expire(`messages:${roomId}`, remaining)
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

      const messages = await redis.lrange<string>(`messages:${roomId}`, 0, -1)
      const messageIndex = messages.findIndex((m) => {
        const parsed = typeof m === "string" ? JSON.parse(m) : m
        return parsed.id === messageId
      })

      if (messageIndex === -1) {
        return messageNotFound()
      }

      const messageStr = messages[messageIndex]
      const message = typeof messageStr === "string" ? JSON.parse(messageStr) : messageStr
      if (message.token !== token) {
        // Explicit 403 response: scoped plugin errors do not reach this
        // router's error pipeline, and ownership must never surface as a 500.
        return ownershipForbidden()
      }

      const deletedMessage = { ...message, deleted: true, text: "" }
      await redis.lset(`messages:${roomId}`, messageIndex, JSON.stringify(deletedMessage))

      await realtime.channel(roomId).emit("chat.message", deletedMessage)

      const remaining = await redis.ttl(`meta:${roomId}`)
      await redis.expire(`messages:${roomId}`, remaining)

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