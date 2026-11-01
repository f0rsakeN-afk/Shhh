import { describe, expect, test } from "bun:test"
import { sanitizeText, sanitizeUsername, safeGetInitials } from "@/lib/sanitize"

describe("sanitizeText", () => {
  test("strips HTML tags entirely", () => {
    expect(sanitizeText("<script>alert(1)</script>hello")).toBe("alert(1)hello")
    expect(sanitizeText("<b>bold</b>")).toBe("bold")
  })

  test("removes control characters", () => {
    expect(sanitizeText("a\u0000b\u001fc")).toBe("abc")
  })

  test("collapses repeated whitespace and trims", () => {
    expect(sanitizeText("  a    b  ")).toBe("a b")
  })

  test("non-string input becomes empty", () => {
    expect(sanitizeText(null as unknown as string)).toBe("")
  })
})

describe("sanitizeUsername", () => {
  test("strips quotes and angle brackets", () => {
    // Tags extract first, then remnants like quotes drop out.
    expect(sanitizeUsername('"><script>x')).toBe("x")
    // A stripped tag can end on a dash boundary.
    expect(sanitizeUsername('O"Hara-<b>x')).toBe("OHara-x")
  })
})

describe("safeGetInitials", () => {
  test("uses the second dash part when present", () => {
    expect(safeGetInitials("Room-Zara")).toBe("Z")
  })

  test("falls back to the first character", () => {
    expect(safeGetInitials("zara")).toBe("Z")
  })

  test("empty input renders a placeholder", () => {
    expect(safeGetInitials("")).toBe("?")
  })
})
