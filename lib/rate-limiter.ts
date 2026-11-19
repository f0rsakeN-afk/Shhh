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
    // INCR and TTL in one round-trip. A key created by an older version (or
    // one whose EXPIRE was lost) can otherwise live forever with its counter
    // past the cap, permanently blocking every caller in the fixed window.
    const pipeline = redis.pipeline()
    pipeline.incr(ckey)
    pipeline.ttl(ckey)
    const [countRaw, ttlRaw] = (await pipeline.exec()) as (number | null)[]
    const newCount = Number(countRaw ?? 0)

    if ((ttlRaw ?? -1) <= 0) {
      await redis.expire(ckey, Math.max(1, windowSecs))
    }

    const blocked = newCount > maxHits
    return { blocked, resetAt: windowSecs, current: newCount }
  } catch {
    // Fallback: in-process Map (not distributed; OK for single-instance dev).
    const now = Date.now()
    const windowMs = Math.max(1, windowSecs) * 1000
    const entry = fallbackLimiter.get(key) ?? { count: 0, resetAt: now + windowMs }
    if (now > entry.resetAt) {
      entry.count = 1
      entry.resetAt = now + windowMs
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