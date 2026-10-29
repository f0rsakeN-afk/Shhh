"use client"

import dynamic from "next/dynamic"
import { useTheme } from "@/components/theme-provider"

// Loaded after paint: the toast layer is not part of the critical path.
const Toaster = dynamic(
  () => import("sileo").then((module) => module.Toaster),
  { ssr: false },
)

const toastOptions = {
  duration: 3200,
  roundness: 12,
  autopilot: { expand: 120, collapse: 5000 },
} as const

const toastOffset = { bottom: 24, right: 24 } as const

export function ToastProvider() {
  const { resolvedTheme } = useTheme()

  return (
    <Toaster
      position="bottom-right"
      offset={toastOffset}
      options={toastOptions}
      theme={resolvedTheme}
    />
  )
}
