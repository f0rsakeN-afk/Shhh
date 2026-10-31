"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RealtimeProvider } from "@upstash/realtime/client"
import { useState } from "react"
import { ToastProvider } from "@/components/toast-provider"

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
            retry: false,
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
      </QueryClientProvider>
    </RealtimeProvider>
  )
}