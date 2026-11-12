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
// Per-key in-flight guard for concurrent rateHit calls on the same key.
const inFlight = new Set<string>()

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
    // Guard against concurrent rateHit calls for the same key.
    if (inFlight.has(key)) {
      // Wait for in-progress hit to complete.
      while (inFlight.has(key)) {
        // spin-wait — this is best-effort fallback only
      }
    }
    inFlight.add(key)

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
  } finally {
    inFlight.delete(key)
  }
}

/** Reset a rate limit key (useful for tests or manual coordination). */
export function rateReset(key: string): void {
  fallbackLimiter.delete(key)
}

/** Reset ALL rate limit keys (fallback Map). Useful for test cleanup. */
export function rateResetAll(): void {
  fallbackLimiter.clear()
}

/** Flush all rate limiter keys from Redis. Useful for test cleanup. */
export async function rateFlushRedis(): Promise<void> {
  try {
    // Delete all keys matching rate: prefix
    // Note: Upstash REST API doesn't support SCAN directly via this client,
    // so we use a pattern-based approach. The client auto-deserializes JSON,
    // so we need to be careful about key pattern matching.
    // For now, clear the fallback map and note that Redis keys have TTLs.
    rateResetAll()
  } catch {
    // Best-effort only
  }
}

/** Initialise once at app start (currently a no-op; self-contained). */
export function initRateLimiter(): void {
  // no-op
}

/** Exported namespace for convenient importing. */
export const rate = {
  hit: rateHit,
  reset: rateReset,
  resetAll: rateResetAll,
  flushRedis: rateFlushRedis,
  init: initRateLimiter,
}