"use client"

import { UserAvatar } from "./user-avatar"
import { cn } from "@/lib/utils"

interface PresenceIndicatorProps {
  username: string
  status: "online" | "offline" | "away"
  participants?: Array<{ username: string; status: "online" | "offline" | "away" }>
}

/** Single-user status label */
const statusLabels: Record<
  "online" | "offline" | "away",
  { dot: string; label: string }
> = {
  online: { dot: "bg-success", label: "Online" },
  away: { dot: "bg-warning", label: "Away" },
  offline: { dot: "bg-muted-foreground/50", label: "Offline" },
}

/** Render a participant avatar + name + dot */
function ParticipantTag({
  part,
  currentUsername,
}: {
  part: { username: string; status: "online" | "offline" | "away" }
  currentUsername: string
}) {
  const isCurrent = part.username === currentUsername
  const label = statusLabels[part.status].label

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent/5 focus-visible:bg-accent/5 duration-150",
        isCurrent && "ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
      )}
    >
      <UserAvatar username={part.username} size="sm" isCurrentUser={isCurrent} />
      <span className="min-w-0 flex-1 truncate text-foreground">
        {part.username}
      </span>
      <span
        className={cn("h-1.5 w-px shrink-0 bg-line", "align-middle")}
        aria-hidden="true"
      />
      <span
        className={cn("inline-flex size-1.5 rounded-full", statusLabels[part.status].dot)}
        aria-hidden="true"
      />
      <span className="text-[10px] font-medium align-middle">{label}</span>
    </div>
  )
}

export function PresenceIndicator({
  username,
  status,
  participants,
}: PresenceIndicatorProps) {
  const label = statusLabels[status].label

  // Single-user mode (backward compatible): show just this user's status
  if (!participants || participants.length === 0) {
    return (
      <div className="flex items-center gap-2.5">
        <UserAvatar username={username} size="sm" isCurrentUser={true} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {username}
        </span>
        <span className="h-3 w-px shrink-0 bg-line" aria-hidden="true" />
        <span
          className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
          title={username + " is " + label.toLowerCase()}
        >
          {label}
        </span>
      </div>
    )
  }

  // Multi-user mode: show participants sidebar/grid
  const onlineCount = participants.filter(
    (p) => p.status === "online",
  ).length

  return (
    <div className="flex items-center gap-2.25">
      {/* Current user avatar + name */}
      <UserAvatar username={username} size="sm" isCurrentUser={true} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {username}
      </span>

      {/* Participants count + scrollable grid */}
      <div className="hidden w-px border-line" aria-hidden="true" />

      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "text-xs font-medium text-muted-foreground",
            "title:" + username + " is " + label.toLowerCase(),
          )}
          title={username + " is " + label.toLowerCase()}
        >
          {onlineCount}/{participants.length} online
        </span>

        {/* Scrollable participants grid */}
        <div
          className={cn(
            "inline-flex items-center gap-0.5 flex-wrap",
            "max-w-[calc(100%-140px)] overflow-x-auto -mx-1",
          )}
        >
          {participants.map((part) => (
            <ParticipantTag key={part.username} part={part} currentUsername={username} />
          ))}
        </div>
      </div>
    </div>
  )
}