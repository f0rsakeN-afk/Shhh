import { redis } from "@/lib/redis"
import { InferRealtimeEvents, Realtime } from "@upstash/realtime"
import { realtimeSchema, type Message } from "@/lib/schemas"
import { ROOM_DURATIONS } from "@/lib/room"

// Real-time client initialized with Upstash Redis. Throws at module load if
// credentials are absent, so the operator knows immediately configuration is
// missing rather than silently running without live features.
export const realtime = new Realtime({
  schema: realtimeSchema,
  redis,
  maxDurationSecs: 300,
  history: {
    // Only the newest 50 events are retained, so keeping them for the
    // longest room lifetime costs bounded memory and lets a reconnect in a
    // 24-hour room replay recent events instead of falling back to REST.
    maxLength: 50,
    expireAfterSecs: ROOM_DURATIONS["24h"],
  },
})
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>
export type { Message }