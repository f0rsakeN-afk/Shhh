import { redis } from "@/lib/redis"
import Elysia from "elysia"

class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthError"
  }
}

/**
 * Structural slice of Elysia's response context that error helpers use to
 * set the HTTP status without owning the whole context type.
 */
export interface SetBox {
  status?: number | string
}

/**
 * Identity-bearing mutation denied: ownership must never surface as a 500,
 * and scoped plugin errors do not reach the parent router's error pipeline,
 * so routes return these failures directly. Every helper funnels through
 * the same `{ error: string }` shape so Eden infers one discriminated
 * union per route on the client.
 */
export function ownershipForbidden(set: SetBox) {
  set.status = 403
  return { error: "Forbidden" }
}

export function messageNotFound(set: SetBox) {
  set.status = 404
  return { error: "Message not found" }
}

/** The token is connected but has no joined identity registered. */
export function identityUnknown(set: SetBox) {
  set.status = 401
  return { error: "Unauthorized" }
}

/** The client hit the per-token flood window. */
export function tooManyRequests(set: SetBox) {
  set.status = 429
  return { error: "Sending too fast, try again in a moment" }
}

/** A mutation carried no useful content after sanitization. */
export function emptyMessage(set: SetBox) {
  set.status = 422
  return { error: "Message is empty" }
}

/** A join attempt with a blank or all-symbols name. */
export function emptyUsername(set: SetBox) {
  set.status = 422
  return { error: "Pick a non-empty name" }
}

/** The room already holds its maximum number of joined participants. */
export function roomFull(set: SetBox) {
  set.status = 403
  return { error: "Room is full" }
}

/** Another participant in this room already uses this name. */
export function nameTaken(set: SetBox) {
  set.status = 409
  return { error: "That name is already taken in this room" }
}

/**
 * Fixed-window flood counter keyed on the auth token. The expiry is only
 * stamped when the counter is created, so the window opens with the first
 * hit and a steady user just under the cap is never penalized forever.
 * Returns false when the caller exceeds `max` hits per window.
 */
export async function floodGate(
  roomId: string,
  token: string,
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const floodKey = `flood:${roomId}:${bucket}:${token}`

  const pipeline = redis.pipeline()
  pipeline.incr(floodKey)
  pipeline.ttl(floodKey)
  const pipelineResult = (await pipeline.exec()) as number[] | null
  const [hitCount, windowTtl] = pipelineResult ?? []

  if ((windowTtl ?? 0) <= 0) {
    await redis.expire(floodKey, windowSeconds)
  }

  return (hitCount ?? 0) <= max
}

export const authMiddleware = new Elysia({ name: "auth" })
  .error({ AuthError })
  // Scoped: every router that uses this middleware also inherits the handler,
  // so a thrown AuthError becomes a proper 401 rather than a 500.
  .onError({ as: "scoped" }, ({ code, set }) => {
    if (code === "AuthError") {
      set.status = 401
      return { error: "Unauthorized" }
    }
  })
  .derive({ as: "scoped" }, async ({ query, cookie }) => {
    const roomId = query.roomId
    // The cookie jar can omit entries entirely; defensive access keeps a
    // malformed request from crashing the middleware instead of 401-ing.
    const token = (
      cookie as Readonly<Record<string, { value?: unknown }> | undefined>
    )?.["x-auth-token"]?.value as string | undefined

    if (!roomId || !token) {
      throw new AuthError("Missing roomId or token.")
    }

    // Room ids are short slugs; anything longer or oddly shaped is not a
    // room and must not become an unbounded Redis key suffix.
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(roomId)) {
      throw new AuthError("Malformed roomId")
    }

    const connectedRaw = await redis.hget<string | string[]>(`meta:${roomId}`, "connected")
    const connected = Array.isArray(connectedRaw)
      ? connectedRaw
      : connectedRaw
        ? JSON.parse(connectedRaw)
        : []

    if (!connected.includes(token)) {
      throw new AuthError("Invalid token")
    }

    // Identity is resolved from the token, never from request bodies.
    // Fresh tokens that have not joined yet yield no user; routes that
    // need one handle that case themselves.
    const userData = await redis.hget<
      string | { username?: unknown; avatar?: unknown } | null
    >(`users:${roomId}`, token)

    let username: string | undefined
    let avatar: number | undefined

    if (typeof userData === "string") {
      try {
        const parsed = JSON.parse(userData)
        if (typeof parsed?.username === "string") {
          username = parsed.username
        }
        if (Number.isInteger(parsed?.avatar)) {
          avatar = parsed.avatar as number
        }
      } catch {
        // Pre-avatar joins stored a plain username string.
        if (userData.trim()) username = userData
      }
    } else if (userData && typeof userData.username === "string") {
      username = userData.username
      if (Number.isInteger(userData.avatar)) {
        avatar = userData.avatar as number
      }
    }

    return {
      auth: {
        roomId,
        token,
        connected,
        user: username ? { username, avatar } : null,
      },
    }
  })
