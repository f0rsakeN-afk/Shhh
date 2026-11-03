import { z } from "zod"
import { ROOM_ID_RE } from "@/lib/room"

/**
 * Reusable scalar bounds. Every field that can enter storage or a render is
 * capped here, so an oversized payload is rejected at the edge instead of
 * becoming an oversized Redis value or a layout-breaking string.
 */
const id = z.string().min(1).max(64)
const username = z.string().min(1).max(24)
/** A reaction chip is a grapheme cluster; 16 code units is generous. */
const emoji = z.string().min(1).max(16)
const messageText = z.string().max(1000)
const timestamp = z.number().int().nonnegative()

export const reactionSchema = z.object({
  emoji,
  username,
  timestamp,
})

export const readReceiptSchema = z.object({
  username,
  timestamp,
})

export const messageSchema = z.object({
  id,
  sender: username,
  text: messageText,
  timestamp,
  roomId: z.string().regex(ROOM_ID_RE),
  token: z.string().max(64).optional(),
  avatar: z.number().int().min(0).max(9).optional(),
  reactions: z.array(reactionSchema).max(100).optional(),
  readBy: z.array(readReceiptSchema).max(100).optional(),
  edited: z.boolean().optional(),
  deleted: z.boolean().optional(),
})

export const chatDestroySchema = z.object({
  isDestroyed: z.literal(true),
})

export const roomIdQuerySchema = z.object({
  // Room ids are nanoid-sized slugs; bounding the shape keeps an arbitrary
  // string from becoming an unbounded Redis key suffix.
  roomId: z.string().regex(ROOM_ID_RE),
})

/** History pagination: newest page by default, or continue below `before`. */
export const messagesQuerySchema = z.object({
  roomId: z.string().regex(ROOM_ID_RE),
  before: z.coerce.number().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
})

export const createMessageBodySchema = z.object({
  text: z.string().min(1).max(1000),
})

/** Room lifetime token accepted at creation; maps to seconds in lib/room. */
export const roomDurationSchema = z.enum(["15m", "1h", "24h"])

export const createRoomBodySchema = z.object({
  duration: roomDurationSchema.optional(),
})

export const editMessageBodySchema = z.object({
  messageId: z.string().max(64),
  text: z.string().max(1000),
})

export const typingSchema = z.object({
  username: z.string(),
  isTyping: z.boolean(),
})

export const presenceSchema = z.object({
  username: z.string(),
  status: z.enum(["online", "offline", "away"]),
  lastSeen: z.number().optional(),
  avatar: z.number().optional(),
})

export const connectionSchema = z.object({
  username: z.string(),
  action: z.enum(["joined", "left"]),
  timestamp: z.number(),
  avatar: z.number().optional(),
})

export const messageEditSchema = z.object({
  messageId: z.string(),
  text: z.string(),
  editedAt: z.number().optional(),
})

export const reactionUpdateSchema = z.object({
  messageId: z.string(),
  // Server-authoritative normalized state for the whole message. Clients
  // assign it instead of merging deltas so everyone converges.
  reactions: z.array(reactionSchema),
})

export const realtimeSchema = {
  chat: {
    message: messageSchema,
    destroy: chatDestroySchema,
    typing: typingSchema,
    presence: presenceSchema,
    connection: connectionSchema,
    reaction: reactionUpdateSchema,
    edited: messageEditSchema,
  },
}

export type Message = z.infer<typeof messageSchema>
export type Reaction = z.infer<typeof reactionSchema>
export type ReactionUpdate = z.infer<typeof reactionUpdateSchema>
export type ReadReceipt = z.infer<typeof readReceiptSchema>
export type ChatDestroy = z.infer<typeof chatDestroySchema>
export type RoomIdQuery = z.infer<typeof roomIdQuerySchema>
export type CreateMessageBody = z.infer<typeof createMessageBodySchema>
export type CreateRoomBody = z.infer<typeof createRoomBodySchema>
export type MessageEdit = z.infer<typeof messageEditSchema>
