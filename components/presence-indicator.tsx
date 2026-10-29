"use client"

import { UserAvatar } from "./user-avatar"
import { Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { MAX_ROOM_PARTICIPANTS } from "@/lib/room"
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetPanel } from "@/components/ui/sheet"

interface PresenceIndicatorProps {
  username: string
  status: "online" | "offline" | "away"
  participants?: Array<{ username: string; status: "online" | "offline" | "away" }>
  onCopyInvite?: () => void
}

const statusStyles = {
  online: { dot: "bg-success", label: "Online" },
  away: { dot: "bg-warning", label: "Away" },
  offline: { dot: "bg-muted-foreground/50", label: "Offline" },
} as const

function statusDot(status: "online" | "offline" | "away") {
  const s = statusStyles[status]
  return (
    <span
      className={cn("relative inline-flex size-1.5", s.dot)}
      aria-hidden="true"
    />
  )
}

export function PresenceIndicator({
  username,
  participants,
  onCopyInvite,
}: PresenceIndicatorProps) {
  const activeParticipants = participants ?? []
  const onlineCount = activeParticipants.filter(
    (p) => p.status === "online",
  ).length

  return (
    <Sheet>
      <SheetTrigger as-child>
        <button
          type="button"
          aria-label="People in this room"
          className={cn(
            "rounded-md bg-transparent p-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors duration-150 pointer-coarse:h-12 pointer-coarse:w-12",
            "flex items-center gap-1.5",
          )}
        >
          <Users className="size-4.5" strokeWidth={1.8} />
          <span className="hidden sm:inline sm:text-xs font-medium text-foreground">
            {activeParticipants.length} in room
          </span>
        </button>
      </SheetTrigger>

      <SheetContent className="p-0">
        <SheetHeader>
          <SheetTitle>People in this room</SheetTitle>
          <SheetDescription>
            {activeParticipants.length} participating{activeParticipants.length !== 1 && "s"}
          </SheetDescription>
        </SheetHeader>

        <SheetFooter className="p-2 border-t border-line">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {onlineCount}/{activeParticipants.length} online
            </span>
            {onCopyInvite && (
              <button
                type="button"
                onClick={onCopyInvite}
                className="rounded-md border border-line bg-background px-2 text-[11px] font-medium text-foreground shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Copy invite link"
              >
                Copy link
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Up to {MAX_ROOM_PARTICIPANTS} people. Messages disappear when the room closes.
          </p>
        </SheetFooter>

        <SheetPanel className="h-full overflow-y-auto p-2">
          {activeParticipants.map((part) => (
            <div
              key={part.username}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 hover:bg-accent/5 focus-visible:bg-accent/5 transition-colors duration-150",
                part.username === username && "ring-2 ring-ring/30 ring-offset-2 ring-offset-background",
              )}
            >
              <UserAvatar
                username={part.username}
                size="sm"
                isCurrentUser={part.username === username}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {part.username}
              </span>
              {statusDot(part.status)}
            </div>
          ))}
        </SheetPanel>
      </SheetContent>
    </Sheet>
  )
}