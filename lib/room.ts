/**
 * Room lifetime choices. The creator picks one at creation; the room's TTL
 * is stamped once and every key inherits it, so no later read or write can
 * extend a room's life.
 */
export const ROOM_DURATIONS = {
  "15m": 15 * 60,
  "1h": 60 * 60,
  "24h": 24 * 60 * 60,
} as const

export type RoomDuration = keyof typeof ROOM_DURATIONS

export const DEFAULT_ROOM_DURATION: RoomDuration = "1h"

/** Seconds for a validated duration token, falling back to the default. */
export function roomDurationSeconds(duration?: RoomDuration | null): number {
  return ROOM_DURATIONS[duration ?? DEFAULT_ROOM_DURATION]
}

export const MAX_ROOM_PARTICIPANTS = 10

/**
 * Room ids are nanoid slugs. One pattern governs every boundary that turns a
 * path/query value into a Redis key (proxy door, auth middleware, zod query
 * schemas), so no layer can disagree about what a room id may contain.
 */
export const ROOM_ID_RE = /^[A-Za-z0-9_-]{8,64}$/

export function isValidRoomId(value: unknown): value is string {
  return typeof value === "string" && ROOM_ID_RE.test(value)
}

/**
 * How long after sending a message its author may still edit it. Server-
 * enforced on POST /messages/edit; the client only mirrors it to hide the
 * Edit affordance. A bounded window keeps the transcript's value to late
 * readers (who saw earlier text in notifications/receipts) meaningful.
 */
export const EDIT_WINDOW_MS = 5 * 60 * 1000

/**
 * ZSET mapping joining tokens to their issuance timestamps. The proxy issues
 * a token on first page load; the user still needs to pick a name and send
 * /join, so the staleness sweep needs to know which connected tokens are
 * mid-handshake rather than abandoned.
 */
export const pendingKeyFor = (roomId: string) => `pending:${roomId}`
