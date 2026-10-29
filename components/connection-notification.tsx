"use client"

import { LogIn, LogOut } from "lucide-react"

interface ConnectionNotificationProps {
  username: string
  action: "joined" | "left"
}

export function ConnectionNotification({
  username,
  action,
}: ConnectionNotificationProps) {
  const Icon = action === "joined" ? LogIn : LogOut

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex shrink-0 justify-center px-3 py-2 sm:px-6"
    >
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-card px-2.5 py-1 text-xs text-muted-foreground shadow-xs">
        <Icon
          className={
            action === "joined" ? "size-3 text-success" : "size-3 text-muted-foreground"
          }
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <span className="max-w-[180px] truncate font-medium text-foreground sm:max-w-[280px]">
          {username}
        </span>
        {action === "joined" ? "joined the room" : "left the room"}
      </span>
    </div>
  )
}
