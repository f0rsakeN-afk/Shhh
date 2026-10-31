export const ROOM_TTL_SECONDS = 60 * 60

export const MAX_ROOM_PARTICIPANTS = 10

/**
 * ZSET mapping joining tokens to their issuance timestamps. The proxy issues
 * a token on first page load; the user still needs to pick a name and send
 * /join, so the staleness sweep needs to know which connected tokens are
 * mid-handshake rather than abandoned.
 */
export const pendingKeyFor = (roomId: string) => `pending:${roomId}`
