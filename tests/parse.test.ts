import { describe, expect, test } from "bun:test"
import {
  parsePresence,
  parseUserRecord,
  safeJsonParse,
  toFiniteNumber,
  toStringArray,
} from "@/lib/parse"

describe("safeJsonParse", () => {
  test("parses strings and passes objects through", () => {
    expect(safeJsonParse<{ a: number }>('{"a":1}')).toEqual({ a: 1 })
    expect(safeJsonParse({ a: 1 })).toEqual({ a: 1 })
  })

  test("malformed input degrades to null instead of throwing", () => {
    expect(safeJsonParse("{not json")).toBeNull()
    expect(safeJsonParse(null)).toBeNull()
    expect(safeJsonParse(undefined)).toBeNull()
  })
})

describe("toStringArray", () => {
  test("accepts arrays and JSON strings, dropping non-strings", () => {
    expect(toStringArray(["a", "b"])).toEqual(["a", "b"])
    expect(toStringArray('["a","b"]')).toEqual(["a", "b"])
    expect(toStringArray(["a", 1, null, { x: 1 }])).toEqual(["a"])
  })

  test("anything else becomes an empty list", () => {
    expect(toStringArray(null)).toEqual([])
    expect(toStringArray("{bad")).toEqual([])
    expect(toStringArray({ a: 1 })).toEqual([])
  })
})

describe("toFiniteNumber", () => {
  test("keeps finite numbers and coerces numeric strings", () => {
    expect(toFiniteNumber(5)).toBe(5)
    expect(toFiniteNumber("5")).toBe(5)
  })

  test("falls back for NaN/Infinity/garbage", () => {
    expect(toFiniteNumber(Number.NaN, 7)).toBe(7)
    expect(toFiniteNumber(Number.POSITIVE_INFINITY, 7)).toBe(7)
    expect(toFiniteNumber("nope", 7)).toBe(7)
  })
})

describe("parsePresence", () => {
  test("reads both stored shapes", () => {
    const raw = { username: "Zara", lastSeen: 123 }
    expect(parsePresence(JSON.stringify(raw))).toEqual(raw)
    expect(parsePresence(raw)).toEqual(raw)
  })

  test("malformed entries become null", () => {
    expect(parsePresence("{bad")).toBeNull()
    expect(parsePresence({ username: 42, lastSeen: 1 })).toBeNull()
    expect(parsePresence({ username: "Zara", lastSeen: "soon" })).toBeNull()
  })
})

describe("parseUserRecord", () => {
  test("reads the pre-avatar plain-string form", () => {
    expect(parseUserRecord("Zara")).toEqual({ username: "Zara" })
  })

  test("reads JSON and object forms with a valid avatar", () => {
    expect(parseUserRecord('{"username":"Zara","avatar":4}')).toEqual({
      username: "Zara",
      avatar: 4,
    })
    expect(parseUserRecord({ username: "Zara", avatar: 12 })).toEqual({
      username: "Zara",
      avatar: undefined,
    })
  })

  test("rejects anything without a username", () => {
    expect(parseUserRecord({ avatar: 2 })).toBeNull()
    expect(parseUserRecord(42)).toBeNull()
  })
})
