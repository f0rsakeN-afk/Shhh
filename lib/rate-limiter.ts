/**
 * Distributed rate limiter using Redis INCR/EXPIRE.
 *
 * Works across server instances. On Redis failure falls back to an
 * in-process Map (best-effort only). Lua-script-free.
 *
 * Key: rate:${key}
 * Value (JSON string): { count: number, resetAt: number }
 */

// Redis client is imported from the global provider; typed via the
// shared `redis` proxy defined in lib/redis.ts.
import { redis } from "@/lib/redis"

// Module-scoped fallback store (populated on first rateHit call).
const fallbackLimiter: Map<string, { count: number; resetAt: number }> = new Map()

/** Hit a rate limit key; returns { blocked, resetAt, current } */
export async function rateHit(
  key: string,
  windowSecs: number,
  maxHits: number,
): Promise<{ blocked: boolean; resetAt: number; current: number }> {
  const ckey = `rate:${key}`
  try {
    const newCount = await redis.incr(ckey)

    // If the first hit, set the expiry so the key auto-expires.
    if (newCount === 1) {
      await redis.expire(ckey, windowSecs)
    }

    const blocked = newCount > maxHits
    return { blocked, resetAt: windowSecs, current: newCount }
  } catch {
    // Fallback: in-process Map (not distributed; OK for single-instance dev).
    const now = Date.now()
    const entry = fallbackLimiter.get(key) ?? { count: 0, resetAt: now + windowSecs }
    if (now > entry.resetAt) {
      entry.count = 1
      entry.resetAt = now + windowSecs
    } else {
      entry.count += 1
    }
    fallbackLimiter.set(key, entry)
    const blocked = entry.count > maxHits
    return { blocked, resetAt: entry.resetAt, current: entry.count }
  }
}

/** Reset a rate limit key (useful for tests or manual coordination). */
export function rateReset(key: string): void {
  fallbackLimiter.delete(key)
}

/** Initialise once at app start (currently a no-op; self-contained). */
export function initRateLimiter(): void {
  // no-op
}

/** Exported namespace for convenient importing. */
export const rate = {
  hit: rateHit,
  reset: rateReset,
  init: initRateLimiter,
}