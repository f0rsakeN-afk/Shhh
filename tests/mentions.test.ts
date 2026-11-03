import { describe, expect, test } from "bun:test"
import { splitMentions } from "@/lib/mentions"

describe("splitMentions", () => {
  test("plain text yields a single text segment", () => {
    expect(splitMentions("hello there")).toEqual([
      { kind: "text", text: "hello there" },
    ])
  })

  test("empty text yields no segments", () => {
    expect(splitMentions("")).toEqual([])
  })

  test("marks a mention at the start of the message", () => {
    expect(splitMentions("@Zara look", "Sam")).toEqual([
      { kind: "mention", text: "@Zara" },
      { kind: "text", text: " look" },
    ])
  })

  test("marks a mention mid-sentence and preserves surrounding text", () => {
    expect(splitMentions("hey @Zara, check this", "Sam")).toEqual([
      { kind: "text", text: "hey " },
      { kind: "mention", text: "@Zara" },
      { kind: "text", text: ", check this" },
    ])
  })

  test("the reader's own name becomes a self mention", () => {
    expect(splitMentions("hi @Zara!", "Zara")).toEqual([
      { kind: "text", text: "hi " },
      { kind: "self", text: "@Zara" },
      { kind: "text", text: "!" },
    ])
  })

  test("handles multiple mentions", () => {
    expect(splitMentions("@Zara and @Sam", "Riley")).toEqual([
      { kind: "mention", text: "@Zara" },
      { kind: "text", text: " and " },
      { kind: "mention", text: "@Sam" },
    ])
  })

  test("hyphenated generated names match whole", () => {
    expect(splitMentions("ping @anonymous-banana-x1y2z", "Zara")).toEqual([
      { kind: "text", text: "ping " },
      { kind: "mention", text: "@anonymous-banana-x1y2z" },
    ])
  })

  test("a trailing sentence dot is not swallowed into the name", () => {
    expect(splitMentions("thanks @Sam.", "Zara")).toEqual([
      { kind: "text", text: "thanks " },
      { kind: "mention", text: "@Sam" },
      { kind: "text", text: "." },
    ])
  })

  test("an email address is not a mention", () => {
    expect(splitMentions("mail me at zara@example.com")).toEqual([
      { kind: "text", text: "mail me at zara@example.com" },
    ])
  })

  test("mentions inside parentheses or quotes still highlight", () => {
    expect(splitMentions('(@Sam) said "@Zara"', "Zara")).toEqual([
      { kind: "text", text: "(" },
      { kind: "mention", text: "@Sam" },
      { kind: "text", text: ') said "' },
      { kind: "self", text: "@Zara" },
      { kind: "text", text: '"' },
    ])
  })

  test("no username context still tokenizes as generic mentions", () => {
    expect(splitMentions("hi @Zara", undefined)).toEqual([
      { kind: "text", text: "hi " },
      { kind: "mention", text: "@Zara" },
    ])
  })
})
