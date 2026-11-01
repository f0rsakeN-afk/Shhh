import { describe, expect, test } from "bun:test"
import { requireOk, ApiError, isSessionStale, isThrottled } from "@/lib/api-error"

describe("ApiError helpers", () => {
  test("requireOk throws ApiError with the server message", () => {
    let thrown: unknown
    try {
      // Denormalized Eden response shape straight onto the checker.
      requireOk({ error: "Unauthorized", status: 401 } as unknown as Parameters<typeof requireOk>[0], "fallback")
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(ApiError)
    expect((thrown as ApiError).status).toBe(401)
    expect((thrown as ApiError).message).toBe("Unauthorized")
  })

  test("requireOk falls back to the friendly copy", () => {
    let thrown: unknown
    try {
      requireOk({ error: { value: { message: "" } }, status: 500 } as never, "Could not load messages")
    } catch (err) {
      thrown = err
    }
    expect((thrown as ApiError).message).toBe("Could not load messages")
  })

  test("requireOk passes success data through", () => {
    const data = requireOk<{ roomId: string }>(
      { data: { roomId: "abc" } } as never,
      "unused",
    )
    expect(data.roomId).toBe("abc")
  })

  test("isSessionStale matches only 401", () => {
    expect(isSessionStale(new ApiError("x", 401))).toBe(true)
    expect(isSessionStale(new ApiError("x", 429))).toBe(false)
    expect(isSessionStale(new Error("plain"))).toBe(false)
  })

  test("isThrottled matches only 429", () => {
    expect(isThrottled(new ApiError("x", 429))).toBe(true)
    expect(isThrottled(new ApiError("x", 401))).toBe(false)
  })
})
