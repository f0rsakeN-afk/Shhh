import { redis } from "@/lib/redis"
import Elysia from "elysia"

class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthError"
  }
}

/**
 * A token-authenticated user acting on someone else's message. Ownership
 * must never surface as a 500, and scoped plugin errors do not reach the
 * parent router's error pipeline, so routes return these responses directly.
 */
export function ownershipForbidden(): Response {
  return response(403, "Forbidden")
}

export function messageNotFound(): Response {
  return response(404, "Message not found")
}

/** The token is connected but has no joined identity registered. */
export function identityUnknown(): Response {
  return response(401, "Unauthorized")
}

/** The client hit the per-token flood window. */
export function tooManyRequests(): Response {
  return response(429, "Sending too fast, try again in a moment")
}

function response(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  })
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
