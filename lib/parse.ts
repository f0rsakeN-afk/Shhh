/**
 * Shape-tolerant readers for values that cross the Redis/client boundary.
 *
 * The Upstash client auto-deserializes JSON, so the same logical value can
 * arrive as a string, an already-parsed object, or an array depending on the
 * client version and command. These helpers turn each of those into one
 * predictable type and never throw on malformed data — a corrupted hash
 * entry should degrade to "no value", not take down the request with a 500.
 */

export function safeJsonParse<T = unknown>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== "string") return raw as T

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Normalizes a connected-tokens value to a string array. Anything that is not
 * a string element is dropped, so a malformed value can never smuggle a
 * non-string into code that assumes `string[]`.
 */
export function toStringArray(raw: unknown): string[] {
  const parsed = typeof raw === "string" ? safeJsonParse<unknown>(raw) : raw
  if (!Array.isArray(parsed)) return []
  return parsed.filter((value): value is string => typeof value === "string")
}

/** A finite number or `fallback`; protects arithmetic from NaN/Infinity. */
export function toFiniteNumber(raw: unknown, fallback = 0): number {
  const value = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(value) ? value : fallback
}

/** Stored presence heartbeat; malformed entries degrade to `null`. */
export interface PresenceSnapshot {
  username: string
  lastSeen: number
}

export function parsePresence(raw: unknown): PresenceSnapshot | null {
  const value =
    typeof raw === "string" ? safeJsonParse<Record<string, unknown>>(raw) : raw
  if (!value || typeof value !== "object") return null

  const { username, lastSeen } = value as Record<string, unknown>
  if (typeof username !== "string" || username.length === 0) return null
  const seen = typeof lastSeen === "number" ? lastSeen : Number(lastSeen)
  if (!Number.isFinite(seen)) return null

  return { username, lastSeen: seen }
}

/** Stored participant identity; supports the pre-avatar plain-string form. */
export interface UserSnapshot {
  username: string
  avatar?: number
}

export function parseUserRecord(raw: unknown): UserSnapshot | null {
  if (typeof raw === "string") {
    const parsed = safeJsonParse<Record<string, unknown>>(raw)
    if (!parsed) {
      // Pre-avatar joins stored a plain username string.
      const legacy = raw.trim()
      return legacy ? { username: legacy } : null
    }
    return parseUserRecord(parsed)
  }

  if (!raw || typeof raw !== "object") return null
  const { username, avatar } = raw as Record<string, unknown>
  if (typeof username !== "string" || username.length === 0) return null

  return {
    username,
    avatar:
      typeof avatar === "number" &&
      Number.isInteger(avatar) &&
      avatar >= 0 &&
      avatar <= 9
        ? avatar
        : undefined,
  }
}
