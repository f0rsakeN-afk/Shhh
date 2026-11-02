import { describe, expect, test } from "bun:test"
import {
  applyEditedMessage,
  applyIncomingMessage,
  assignMessageReactions,
} from "@/lib/message-reducers"
import type { Message } from "@/lib/schemas"

const ME = "Zara"
const OTHER = "Sam"

const baseHistory = (messages: Message[]) => ({
  messages,
  hasMore: false,
})

const serverMessage = (overrides: Partial<Message> = {}): Message => ({
  id: "srv-1",
  sender: OTHER,
  text: "hello",
  timestamp: 1000,
  roomId: "testroom",
  ...overrides,
})

const optimistic = (overrides: Partial<Message> = {}): Message => ({
  id: "temp-abc",
  sender: ME,
  text: "hello",
  timestamp: 1000,
  roomId: "testroom",
  token: "current",
  ...overrides,
})

describe("applyIncomingMessage", () => {
  test("appends a new other-person message with hasMore preserved", () => {
    const old = baseHistory([serverMessage({ id: "srv-0" })])
    const incoming = serverMessage({ id: "srv-1", text: "hi again" })

    const next = applyIncomingMessage(old, incoming, ME)

    expect(next?.messages).toHaveLength(2)
    expect(next?.messages[1]).toEqual({ ...incoming, token: undefined })
    expect(next?.hasMore).toBe(false)
  })

  test("replaces the own optimistic temp-* copy in place", () => {
    const first = serverMessage({ id: "srv-0" })
    const old = baseHistory([first, optimistic()])

    const serverCopy = serverMessage({
      id: "srv-real",
      sender: ME,
      token: undefined,
    })
    const next = applyIncomingMessage(old, serverCopy, ME)

    expect(next?.messages).toHaveLength(2)
    // Position kept, id promoted, token normalized for the current user.
    expect(next?.messages[1].id).toBe("srv-real")
    expect(next?.messages[1].token).toBe("current")
    expect(next?.messages[0].id).toBe("srv-0")
  })

  test("drops an exact duplicate by id (stream replay)", () => {
    const incoming = serverMessage()
    const old = baseHistory([incoming])

    // Identity-unchanged: cheaper cache notifications, memo-friendly.
    expect(applyIncomingMessage(old, incoming, ME)).toBe(old)
  })

  test("drops a same text+sender duplicate inside the replay window", () => {
    const first = serverMessage({ timestamp: 5000 })
    const replay = serverMessage({ id: "srv-2", timestamp: 5800 })
    const old = baseHistory([first])

    expect(applyIncomingMessage(old, replay, ME)).toBe(old)
  })

  test("keeps a same text+sender message outside the replay window", () => {
    const first = serverMessage({ timestamp: 5000 })
    const next = serverMessage({ id: "srv-2", timestamp: 9500 })
    const old = baseHistory([first])

    const result = applyIncomingMessage(old, next, ME)
    expect(result?.messages).toHaveLength(2)
  })

  test("keeps a same-text message from a different sender inside the window", () => {
    const first = serverMessage({ timestamp: 5000 })
    const mine = serverMessage({
      id: "srv-2",
      sender: ME,
      timestamp: 5800, // would collide with the first, but a different sender
      token: "current",
    })
    const old = baseHistory([first])

    const result = applyIncomingMessage(old, mine, ME)
    expect(result?.messages).toHaveLength(2)
    expect(result?.messages[1].token).toBe("current")
  })

  test("normalizes the own-message token to 'current'", () => {
    const mine = serverMessage({ id: "srv-9", sender: ME, token: undefined })
    const next = applyIncomingMessage(baseHistory([]), mine, ME)

    expect(next?.messages[0].token).toBe("current")
  })

  test("leaves other people's messages tokenless", () => {
    const next = applyIncomingMessage(baseHistory([]), serverMessage(), ME)
    expect(next?.messages[0].token).toBeUndefined()
  })

  test("passes undefined through when the cache has not loaded", () => {
    expect(applyIncomingMessage(undefined, serverMessage(), ME)).toBeUndefined()
  })
})

describe("applyEditedMessage", () => {
  test("edits the targeted message and flags it", () => {
    const old = baseHistory([serverMessage(), serverMessage({ id: "srv-2" })])

    const next = applyEditedMessage(old, "srv-2", "now different")

    expect(next?.messages[1].text).toBe("now different")
    expect(next?.messages[1].edited).toBe(true)
    expect(next?.messages[0].text).toBe("hello")
    expect(next?.hasMore).toBe(false)
  })

  test("misses return the same object (stale event tolerance)", () => {
    const old = baseHistory([serverMessage()])

    expect(applyEditedMessage(old, "missing-id", "oops")).toBe(old)
  })

  test("passes undefined through when the cache has not loaded", () => {
    expect(applyEditedMessage(undefined, "srv-1", "x")).toBeUndefined()
  })
})

describe("assignMessageReactions", () => {
  const reactions = [
    { emoji: "🔥", username: ME, timestamp: 6000 },
  ]

  test("assigns the server's full reaction state to the targeted message", () => {
    const old = baseHistory([serverMessage()])

    const next = assignMessageReactions(old, "srv-1", reactions)

    expect(next?.messages[0].reactions).toEqual(reactions)
  })

  test("misses return the same object", () => {
    const old = baseHistory([serverMessage()])

    expect(assignMessageReactions(old, "gone", reactions)).toBe(old)
  })

  test("passes undefined through when the cache has not loaded", () => {
    expect(assignMessageReactions(undefined, "srv-1", reactions)).toBeUndefined()
  })
})
