import { describe, expect, test } from "bun:test"
import {
  roomIdQuerySchema,
  messagesQuerySchema,
  createMessageBodySchema,
  editMessageBodySchema,
} from "@/lib/schemas"

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
