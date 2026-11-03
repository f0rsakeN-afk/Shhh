import { describe, expect, test } from "bun:test"
import {
  roomIdQuerySchema,
  messagesQuerySchema,
  createMessageBodySchema,
  createRoomBodySchema,
  editMessageBodySchema,
  roomDurationSchema,
} from "@/lib/schemas"
import { roomDurationSeconds } from "@/lib/room"

describe("roomIdQuerySchema", () => {
  test("accepts nanoid-shaped room ids", () => {
    expect(roomIdQuerySchema.safeParse({ roomId: "abcdefghij" }).success).toBe(true)
    expect(roomIdQuerySchema.safeParse({ roomId: "aA1-_Zz9x-1" }).success).toBe(true)
  })

  test("rejects short or odd-shaped ids", () => {
    expect(roomIdQuerySchema.safeParse({ roomId: "x" }).success).toBe(false)
    expect(roomIdQuerySchema.safeParse({ roomId: "a".repeat(65) }).success).toBe(false)
    expect(roomIdQuerySchema.safeParse({ roomId: "has spaces" }).success).toBe(false)
  })
})

describe("messagesQuerySchema", () => {
  test("coerces numeric strings from the querystring", () => {
    const parsed = messagesQuerySchema.parse({ roomId: "abcdefgh", limit: "100", before: "123" })
    expect(parsed.limit).toBe(100)
    expect(parsed.before).toBe(123)
  })

  test("clamps the page size within 1..200", () => {
    expect(messagesQuerySchema.safeParse({ roomId: "abcdefgh", limit: "500" }).success).toBe(false)
    expect(messagesQuerySchema.safeParse({ roomId: "abcdefgh", limit: "0" }).success).toBe(false)
  })

  test("rejects a non-numeric cursor", () => {
    expect(messagesQuerySchema.safeParse({ roomId: "abcdefgh", before: "abc" }).success).toBe(false)
  })

  test("rejects a negative cursor", () => {
    expect(messagesQuerySchema.safeParse({ roomId: "abcdefgh", before: "-5" }).success).toBe(false)
  })
})

describe("message body schemas", () => {
  test("create body is text only; identity fields no longer accepted", () => {
    const parsed = createMessageBodySchema.parse({ text: "hi" })
    expect("sender" in parsed).toBe(false)
    expect("avatar" in parsed).toBe(false)
  })

  test("create body caps text at 1000 chars", () => {
    expect(createMessageBodySchema.safeParse({ text: "x".repeat(1001) }).success).toBe(false)
    expect(createMessageBodySchema.safeParse({ text: "" }).success).toBe(false)
  })

  test("edit body caps messageId and text", () => {
    expect(editMessageBodySchema.safeParse({ messageId: "x".repeat(65), text: "y" }).success).toBe(false)
    expect(editMessageBodySchema.safeParse({ messageId: "abc", text: "x".repeat(1001) }).success).toBe(false)
  })
})

describe("roomDurationSchema", () => {
  test("accepts the three supported lifetime tokens", () => {
    for (const token of ["15m", "1h", "24h"] as const) {
      expect(roomDurationSchema.safeParse(token).success).toBe(true)
      expect(createRoomBodySchema.safeParse({ duration: token }).success).toBe(true)
    }
  })

  test("rejects unknown or arbitrarily long lifetimes", () => {
    expect(roomDurationSchema.safeParse("3h").success).toBe(false)
    expect(roomDurationSchema.safeParse("7d").success).toBe(false)
    expect(roomDurationSchema.safeParse(3600).success).toBe(false)
  })

  test("the body may omit duration (default room)", () => {
    expect(createRoomBodySchema.safeParse({}).success).toBe(true)
    expect(createRoomBodySchema.safeParse(undefined).success).toBe(false)
  })
})

describe("roomDurationSeconds", () => {
  test("maps tokens to seconds and defaults to one hour", () => {
    expect(roomDurationSeconds("15m")).toBe(15 * 60)
    expect(roomDurationSeconds("1h")).toBe(60 * 60)
    expect(roomDurationSeconds("24h")).toBe(24 * 60 * 60)
    expect(roomDurationSeconds()).toBe(60 * 60)
    expect(roomDurationSeconds(null)).toBe(60 * 60)
  })
})
