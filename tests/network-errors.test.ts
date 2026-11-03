import { describe, expect, test } from "bun:test"
import { ApiError, isNetworkError, networkErrorCopy } from "@/lib/api-error"

describe("network failure classification", () => {
  test("fetch rejections are network errors", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true)
  })

  test("timeouts are network errors", () => {
    expect(
      isNetworkError(new DOMException("Request timed out", "TimeoutError")),
    ).toBe(true)
    expect(
      isNetworkError(new DOMException("The operation was aborted", "AbortError")),
    ).toBe(true)
  })

  test("server responses are never network errors", () => {
    expect(isNetworkError(new ApiError("Forbidden", 403))).toBe(false)
    expect(isNetworkError(new Error("boom"))).toBe(false)
    expect(networkErrorCopy(new ApiError("Forbidden", 403))).toBeNull()
  })

  test("timeout copy is explicit about nothing being changed", () => {
    const copy = networkErrorCopy(
      new DOMException("Request timed out", "TimeoutError"),
    )
    expect(copy?.title).toBe("Connection is too slow")
    expect(copy?.description).toContain("nothing was changed")
  })

  test("a non-timeout fetch failure gets generic connection copy", () => {
    const copy = networkErrorCopy(new TypeError("Failed to fetch"))
    expect(copy?.title.toLowerCase()).toContain("connection")
  })
})
