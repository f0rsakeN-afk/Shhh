import { treaty } from "@elysiajs/eden"
import type { App } from "../app/api/[[...slugs]]/route"

const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return window.location.origin
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
}

/**
 * Slow-network guard: a request that never completes must not leave a
 * mutation pending forever or a query spinning. Twenty seconds is long
 * enough for a 2G round-trip but short enough to surface a real problem.
 * The abort rejects with a `TimeoutError`, which `lib/api-error.ts` maps to
 * the "Connection is too slow" toast.
 */
const REQUEST_TIMEOUT_MS = 20_000

const timedFetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(
      new DOMException("Request timed out", "TimeoutError"),
    )
  }, REQUEST_TIMEOUT_MS)

  const externalSignal = init?.signal
  const forwardAbort = () => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener("abort", forwardAbort, { once: true })
    }
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer)
    externalSignal?.removeEventListener("abort", forwardAbort)
  })
}

export const client = treaty<App>(getBaseUrl(), {
  // Bun's `typeof fetch` also carries `preconnect`; the wrapper is a plain
  // fetch implementation, which is all Eden calls.
  fetcher: timedFetch as typeof fetch,
}).api
