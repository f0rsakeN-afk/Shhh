"use client"

import { TimerReset } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface CountdownTimerProps {
  initialTtl?: number
  onExpire?: () => void
  className?: string
}

function formatTimeRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function CountdownTimer({
  initialTtl,
  onExpire,
  className,
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(
    initialTtl ?? null,
  )
  const [syncedTtl, setSyncedTtl] = useState(initialTtl)

  // Adjust state during render when a fresh TTL arrives, rather than in an
  // effect, so the first paint already shows the server value.
  if (initialTtl !== syncedTtl) {
    setSyncedTtl(initialTtl)
    setTimeRemaining(initialTtl ?? null)
  }

  useEffect(() => {
    if (timeRemaining === null) return

    if (timeRemaining <= 0) {
      onExpire?.()
      return
    }

    const timeout = setTimeout(() => {
      setTimeRemaining((previous) =>
        previous === null ? null : Math.max(0, previous - 1),
      )
    }, 1000)

    return () => clearTimeout(timeout)
  }, [timeRemaining, onExpire])

  const isCritical = timeRemaining !== null && timeRemaining <= 60
  const isWarning = timeRemaining !== null && timeRemaining <= 120
  const formatted =
    timeRemaining !== null ? formatTimeRemaining(timeRemaining) : "--:--"

  return (
    <span
      className={cn(
        "inline-flex h-8 min-w-[4.75rem] shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 font-mono text-xs tabular-nums transition-colors duration-150",
        isCritical
          ? "border-destructive/30 bg-destructive/[0.08] text-destructive-foreground"
          : isWarning
            ? "border-warning/30 bg-warning/[0.08] text-warning-foreground"
            : "border-line bg-card text-muted-foreground",
        className,
      )}
      title="Time until this room self-destructs"
      role="timer"
      aria-live="off"
      aria-label={`Room expires in ${formatted}`}
    >
      <TimerReset
        className={cn("size-3.5", isCritical && "animate-pulse")}
        strokeWidth={1.8}
        aria-hidden="true"
      />
      <span className="min-w-[2.5rem] text-center">{formatted}</span>
    </span>
  )
}
