"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RealtimeProvider } from "@upstash/realtime/client"
import { useState } from "react"
import { ToastProvider } from "@/components/toast-provider"
import { NetworkStatus } from "@/components/network-status"
import { isNetworkError } from "@/lib/api-error"

export const Providers = ({ children }: { children: React.ReactNode }) => {
  // Tuned for a realtime app: data arrives over chat events, so TanStack
  // Query should not refetch on every focus, and cached room data is trusted
  // for a short window instead of being marked stale per mount.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Reads are idempotent, so a flaky link gets two bounded
            // retries with backoff. Mutations stay at zero: re-sending a
            // message automatically would duplicate it.
            retry: (failureCount, error) =>
              failureCount < 2 && isNetworkError(error),
            retryDelay: (attempt) =>
              Math.min(1_000 * 2 ** attempt, 8_000),
          },
          mutations: {
            retry: false,
          },
        },
      }),
  )

  return (
    <RealtimeProvider
      api={{ url: "/api/realtime", withCredentials: false }}
      maxReconnectAttempts={5}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <ToastProvider />
        <NetworkStatus />
      </QueryClientProvider>
    </RealtimeProvider>
  )
}