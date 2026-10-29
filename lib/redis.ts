import { Redis } from "@upstash/redis"

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

export const hasRedisConfig = Boolean(url && token)

let client: Redis | null = null

function createClient() {
  if (!url || !token) {
    throw new Error(
      "Missing Upstash credentials. Copy .env.example to .env.local and set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    )
  }

  return new Redis({ url, token, enableTelemetry: false })
}

/**
 * The client is created on first use rather than on import. That keeps builds
 * and static generation quiet when secrets are absent, while still failing
 * with a clear message if a request reaches Redis without configuration.
 */
export const redis = new Proxy({} as Redis, {
  get(_target, property) {
    client ??= createClient()
    const value = Reflect.get(client, property)

    return typeof value === "function" ? value.bind(client) : value
  },
})
