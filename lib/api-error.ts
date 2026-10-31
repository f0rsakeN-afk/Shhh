/**
 * Eden treaty resolves to `{ data, error, status }` and does NOT throw on
 * non-2xx responses, so every caller must check `error` explicitly. This
 * helper turns that shape into a thrown ApiError with a friendly, typed
 * message the UI can toast without duplicating mapping logic.
 */

export class ApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

interface EdenResponseLike {
  data?: unknown
  error?: unknown
  status?: number
}

/** Extracts the best human-readable text from an Eden/Elysia error body. */
function describe(error: unknown): string | null {
  if (typeof error === "string") {
    return error.trim() || null
  }
  if (!error || typeof error !== "object") {
    return null
  }

  const candidate = error as {
    message?: unknown
    error?: unknown
    value?: unknown
  }

  // EdenFetchError wraps the raw response in `value`.
  if (candidate.value) {
    const nested = describe(candidate.value)
    if (nested) return nested
  }
  if (typeof candidate.error === "string" && candidate.error.trim()) {
    return candidate.error
  }
  if (typeof candidate.message === "string" && candidate.message.trim()) {
    return candidate.message
  }
  return null
}

/**
 * Asserts the call succeeded and returns its data, throwing an ApiError with
 * the server's message (or `fallback`) otherwise.
 */
export function requireOk<TData>(
  response: EdenResponseLike,
  fallback: string,
): TData {
  if (response?.error) {
    throw new ApiError(
      describe(response.error) ?? fallback,
      response.status,
    )
  }
  return response?.data as TData
}

/** True when the caller's session token is no longer registered. */
export function isSessionStale(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}
