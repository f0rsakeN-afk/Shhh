import { describe, expect, test } from "bun:test"
import { nanoid } from "nanoid"
import { GET, POST, DELETE } from "@/app/api/[[...slugs]]/route"
import { redis } from "@/lib/redis"
import { MAX_ROOM_PARTICIPANTS } from "@/lib/room"
import type { Message } from "@/lib/schemas"

/**
 * Route-handler level integration suite against the real Redis layer.
 * Tokens register into `meta.connected` directly (mimicking the proxy) so
 * cookie-augmented requests can replay the API surface the room page
 * drives. Bulk backlogs seed at the storage layer, both for determinism
 * and to keep the send flood gate out of setup paths.
 */

const BASE = "http://test.local/api"
const ROOM_TEST_TTL_SECONDS = 3600

function tokenCookie(token: string): HeadersInit {
  return { cookie: `x-auth-token=${token}`, "content-type": "application/json" }
}

async function registerRoom(roomId: string, tokens: string[]): Promise<void> {
  await redis.hset(`meta:${roomId}`, { connected: JSON.stringify(tokens) })
  await redis.expire(`meta:${roomId}`, ROOM_TEST_TTL_SECONDS)
}

async function join(roomId: string, token: string, username: string, avatar?: number) {
  return POST(
    new Request(`${BASE}/room/join?roomId=${roomId}`, {
      method: "POST",
      headers: tokenCookie(token),
      body: JSON.stringify({ username, avatar }),
    }),
  )
}

async function send(roomId: string, token: string, text: string, extra: Record<string, unknown> = {}) {
  return POST(
    new Request(`${BASE}/messages?roomId=${roomId}`, {
      method: "POST",
      headers: tokenCookie(token),
      body: JSON.stringify({ text, ...extra }),
    }),
  )
}

async function history(roomId: string, token: string, query = "") {
  const res = await GET(
    new Request(`${BASE}/messages?roomId=${roomId}${query}`, {
      headers: tokenCookie(token),
    }),
  )
  return res.json() as Promise<{ messages: Message[]; hasMore?: boolean; error?: string }>
}

/** Bulk-seeds messages (id = text) straight into the HASH + order ZSET. */
async function seedMessages(roomId: string, token: string, sender: string, avatar: number, texts: string[], baseTs = Date.now() - 600_000) {
  const stored: Record<string, string> = {}
  const members: Array<{ member: string; score: number }> = []

  texts.forEach((id, index) => {
    const message: Message = {
      id,
      sender,
      text: id,
      timestamp: baseTs + index * 1000,
      roomId,
      avatar,
      token,
    }
    stored[id] = JSON.stringify(message)
    members.push({ member: id, score: message.timestamp })
  })

  await redis.hset(`msg:${roomId}`, stored)
  await redis.zadd(`order:${roomId}`, ...members)
}

async function cleanup(roomId: string) {
  await Promise.all(
    [
      `meta:${roomId}`,
      `users:${roomId}`,
      `presence:${roomId}`,
      `pending:${roomId}`,
      `msg:${roomId}`,
      `order:${roomId}`,
    ].map((key) => redis.del(key)),
  )
}

let roomId = ""
let userA = ""
let userB = ""

test("setup: room, identities, backlog", async () => {
  roomId = nanoid()
  userA = nanoid()
  userB = nanoid()

  await registerRoom(roomId, [userA, userB])
  expect((await join(roomId, userA, "Zara", 4)).status).toBe(200)
  expect((await join(roomId, userB, "Sam", 1)).status).toBe(200)

  await seedMessages(roomId, userA, "Zara", 4, Array.from({ length: 105 }, (_, i) => `m${i + 1}`))

  const count = await redis.zcard(`order:${roomId}`)
  expect(count).toBe(105)
}, 60_000)

describe("room join integrity", () => {
  test("duplicate names collide server-side with 409", async () => {
    const fresh = nanoid()
    await registerRoom(roomId, [fresh, userA, userB])
    const res = await join(roomId, fresh, "Zara", 2)
    expect(res.status).toBe(409)
  }, 20_000)

  test("capacity rejects joins past the participant ceiling", async () => {
    const filler: Record<string, string> = {}
    for (let i = 0; i < MAX_ROOM_PARTICIPANTS; i++) {
      filler[`filler${i}`] = JSON.stringify({ username: `f${i}`, avatar: 0 })
    }
    await redis.hset(`users:${roomId}`, filler)

    const fresh = nanoid()
    await registerRoom(roomId, [fresh, userA, userB])
    const res = await join(roomId, fresh, "Wren", 3)
    expect(res.status).toBe(403)

    await redis.hdel(`users:${roomId}`, ...Object.keys(filler))
  }, 20_000)
})

describe("message posting integrity", () => {
  test("body spoofing cannot override the cookie identity", async () => {
    const res = await send(roomId, userB, "spoof attempt", {
      sender: "Zara",
      avatar: 9,
    })
    expect(res.status).toBe(200)

    const page = await history(roomId, userB, "&limit=1")
    const message = page.messages.at(-1)
    expect(message?.sender).toBe("Sam")
    expect(message?.avatar).toBe(1)
  }, 60_000)

  test("surfaces the owner token only to its owner", async () => {
    const asA = await history(roomId, userA, "&limit=2")
    const seededView = asA.messages.find((m) => m.id === "m105")
    expect(seededView?.token).toBe(userA)

    const asB = await history(roomId, userB, "&limit=2")
    expect(asB.messages.find((m) => m.id === "m105")?.token).toBeUndefined()
  }, 60_000)

  test("rejects an empty message with 422", async () => {
    const res = await send(roomId, userA, "<b> </b>")
    expect(res.status).toBe(422)
  }, 20_000)

  test("rejects unauthenticated calls with 401", async () => {
    const res = await POST(
      new Request(`${BASE}/messages?roomId=${roomId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "no cookie" }),
      }),
    )
    expect(res.status).toBe(401)
  }, 20_000)

  test("windows history: newest 100 then cursor pages the rest", async () => {
    // 106 total: 105 seeded (m1..m105 oldest-first) + one live message.
    const first = await history(roomId, userA, "&limit=100")
    expect(first.messages).toHaveLength(100)
    expect(first.messages[0]?.text).toBe("m7")
    expect(first.messages.at(-1)?.text).toBe("spoof attempt")
    expect(first.hasMore).toBe(true)

    // Next page resumes just below the oldest id of the previous page.
    const cursor = first.messages[0]?.timestamp as number
    const second = await history(roomId, userA, `&limit=100&before=${cursor}`)
    expect(second.messages.map((m) => m.text)).toEqual(["m1", "m2", "m3", "m4", "m5", "m6"])
    expect(second.hasMore).toBe(false)
  }, 60_000)
})

describe("reactions", () => {
  const targetId = "m50"

  const react = (token: string, emoji: string, action: "add" | "remove") =>
    POST(new Request(`${BASE}/messages/reaction?roomId=${roomId}`, {
      method: "POST",
      headers: tokenCookie(token),
      body: JSON.stringify({ messageId: targetId, emoji, action }),
    }))

  test("keeps exactly one reaction per user per message", async () => {
    expect((await react(userA, "🔥", "add")).status).toBe(200)
    // Same user re-reacting replaces, never accumulates.
    expect((await react(userA, "💙", "add")).status).toBe(200)

    const after = await history(roomId, userB, "&limit=200")
    const one = after.messages.find((m) => m.id === targetId)?.reactions ?? []
    expect(one).toHaveLength(1)
    expect(one[0]?.emoji).toBe("💙")
    expect(one[0]?.username).toBe("Zara")

    // B adds their own slot without touching A's.
    expect((await react(userB, "🔥", "add")).status).toBe(200)
    const both = await history(roomId, userA, "&limit=200")
    const two = both.messages.find((m) => m.id === targetId)?.reactions ?? []
    expect(two).toHaveLength(2)
    expect(two.map((r) => r?.username).sort()).toEqual(["Sam", "Zara"])
  }, 60_000)

  test("removal is idempotent and only ever removes the caller's slot", async () => {
    expect((await react(userB, "🔥", "remove")).status).toBe(200)
    expect((await react(userB, "🔥", "remove")).status).toBe(200)

    const after = await history(roomId, userB, "&limit=200")
    const one = after.messages.find((m) => m.id === targetId)?.reactions ?? []
    expect(one).toHaveLength(1)
    expect(one[0]?.username).toBe("Zara")
  }, 60_000)

  test("flood gate rejects reaction bursts with 429", async () => {
    const burst = await Promise.all(
      Array.from({ length: 16 }, () => react(userA, "👋", "add")),
    )
    expect(burst.some((res) => res.status === 429)).toBe(true)
  }, 60_000)
})

describe("read receipts", () => {
  test("attribute once to the cookie identity", async () => {
    const messageId = (await history(roomId, userA, "&limit=1")).messages[0]?.id as string

    await POST(new Request(`${BASE}/messages/read?roomId=${roomId}`, {
      method: "POST",
      headers: tokenCookie(userB),
      body: JSON.stringify({ messageId }),
    }))

    const asA = await history(roomId, userA)
    const receipts = asA.messages.find((m) => m.id === messageId)?.readBy ?? []
    expect(receipts).toHaveLength(1)
    expect(receipts[0]?.username).toBe("Sam")
  }, 30_000)
})

describe("edit and delete ownership", () => {
  test("a foreign token cannot edit or delete (403)", async () => {
    // m40 was seeded under userA; B must not touch it.
    const editForeign = await POST(new Request(`${BASE}/messages/edit?roomId=${roomId}`, {
      method: "POST",
      headers: tokenCookie(userB),
      body: JSON.stringify({ messageId: "m40", text: "hijack" }),
    }))
    expect(editForeign.status).toBe(403)

    const deleteForeign = await DELETE(new Request(`${BASE}/messages?roomId=${roomId}&messageId=m40`, {
      method: "DELETE",
      headers: tokenCookie(userB),
    }))
    expect(deleteForeign.status).toBe(403)
  }, 30_000)

  test("the owner edits, then deletes; foreign views redact the token", async () => {
    const created = await send(roomId, userA, "own it")
    expect(created.status).toBe(200)

    const current = await history(roomId, userA, "&limit=1")
    const messageId = current.messages.at(-1)?.id as string

    const edited = await POST(new Request(`${BASE}/messages/edit?roomId=${roomId}`, {
      method: "POST",
      headers: tokenCookie(userA),
      body: JSON.stringify({ messageId, text: "edited" }),
    }))
    expect(edited.status).toBe(200)

    const asB = await history(roomId, userB)
    const editedMessage = asB.messages.find((m) => m.id === messageId)
    expect(editedMessage?.text).toBe("edited")
    expect(editedMessage?.edited).toBe(true)
    expect(editedMessage?.token).toBeUndefined()

    const deleted = await DELETE(new Request(`${BASE}/messages?roomId=${roomId}&messageId=${messageId}`, {
      method: "DELETE",
      headers: tokenCookie(userA),
    }))
    expect(deleted.status).toBe(200)

    const afterDelete = await history(roomId, userB)
    const tombstone = afterDelete.messages.find((m) => m.id === messageId)
    expect(tombstone?.deleted).toBe(true)
    expect(tombstone?.text).toBe("")
  }, 60_000)
})

test("cleanup", async () => {
  await cleanup(roomId)
  const remaining = await redis.exists(`meta:${roomId}`)
  expect(remaining).toBe(0)
}, 20_000)
