"use client"

import { UserAvatar } from "./user-avatar"
import { cn } from "@/lib/utils"

interface PresenceIndicatorProps {
  username: string
  status: "online" | "offline" | "away"
}

const statusStyles = {
  online: { dot: "bg-success", label: "Online" },
  away: { dot: "bg-warning", label: "Away" },
  offline: { dot: "bg-muted-foreground/50", label: "Offline" },
} as const

export function PresenceIndicator({ username, status }: PresenceIndicatorProps) {
  const current = statusStyles[status]

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <UserAvatar username={username} size="sm" isCurrentUser={false} />
      <span className="max-w-[160px] truncate text-sm font-medium text-foreground sm:max-w-[260px]">
        {username}
      </span>
      <span className="h-3 w-px shrink-0 bg-line" aria-hidden="true" />
      <span
        className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
        title={`${username} is ${current.label.toLowerCase()}`}
      >
        <span className="relative flex size-1.5">
          {status === "online" && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50" />
          )}
          <span
            className={cn("relative inline-flex size-1.5 rounded-full", current.dot)}
          />
        </span>
        {current.label}
      </span>
    </div>
  )
}
