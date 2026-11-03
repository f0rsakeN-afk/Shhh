export const ROOM_TTL_SECONDS = 60 * 60

export const MAX_ROOM_PARTICIPANTS = 10

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
