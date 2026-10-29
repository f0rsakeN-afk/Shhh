"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RealtimeProvider } from "@upstash/realtime/client"
import { useState } from "react"
import { ToastProvider } from "@/components/toast-provider"

export const Providers = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient())

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