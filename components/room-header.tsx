"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Bomb, Check, Copy, Link2 } from "lucide-react"
import { Brand } from "@/components/brand"
import { ThemeToggle } from "@/components/theme-toggle"
import { CountdownTimer } from "./countdown-timer"
import { toastError, toastSuccess } from "@/lib/toast"
import { cn } from "@/lib/utils"

interface RoomHeaderProps {
  roomId: string
  timeToLive?: number
  onDestroy: () => void
  onExpire?: () => void
  roomUrl: string
}

const iconButton =
  "grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

export function RoomHeader({
  roomId,
  timeToLive,
  onDestroy,
  onExpire,
  roomUrl,
}: RoomHeaderProps) {
  const [copied, setCopied] = useState<"id" | "link" | null>(null)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [])

  const copy = useCallback(async (value: string, type: "id" | "link") => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(type)

      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => setCopied(null), 2000)

      if (type === "id") {
        void toastSuccess({ title: "Room code copied" })
      } else {
        void toastSuccess({
          title: "Invite link copied",
          description: "Send it to the person you want in the room.",
        })
      }
    } catch {
      void toastError({
        title: "Could not copy",
        description: "Your browser blocked the clipboard. Select the text and copy it manually.",
      })
    }
  }, [])

  const copyRoomId = useCallback(() => {
    void copy(roomId, "id")
  }, [copy, roomId])

  const copyInviteLink = useCallback(() => {
    void copy(roomUrl, "link")
  }, [copy, roomUrl])

  return (
    <header className="relative z-30 shrink-0 border-b border-line bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-1.5 border-line px-3 sm:gap-2 md:border-x md:px-6">
        <Brand compact className="mr-0.5 shrink-0" />

        <span className="hidden h-5 w-px shrink-0 bg-line sm:block" />

        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="hidden text-xs text-muted-foreground lg:inline">
            Room
          </span>
          <code
            title={roomId}
            className="max-w-[72px] truncate rounded-md border border-line bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground min-[420px]:max-w-[120px] sm:max-w-[200px]"
          >
            {roomId}
          </code>
          <button
            type="button"
            onClick={copyRoomId}
            aria-label={copied === "id" ? "Room code copied" : "Copy room code"}
            title="Copy room code"
            className={iconButton}
          >
            {copied === "id" ? (
              <Check className="size-3.5 text-success" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <CountdownTimer initialTtl={timeToLive} onExpire={onExpire} />

          <button
            type="button"
            onClick={copyInviteLink}
            aria-label={copied === "link" ? "Invite link copied" : "Copy invite link"}
            title="Copy invite link"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-line px-2 text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-2.5"
          >
            {copied === "link" ? (
              <>
                <Check className="size-3.5 text-success" aria-hidden="true" />
                <span className="hidden sm:inline">Copied</span>
              </>
            ) : (
              <>
                <Link2 className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                <span className="hidden sm:inline">Share</span>
              </>
            )}
          </button>

          <ThemeToggle className="size-8" />

          <button
            type="button"
            onClick={onDestroy}
            aria-label="Destroy room"
            title="Destroy room now"
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-line px-2 text-xs text-destructive-foreground transition-colors duration-150 hover:border-destructive/30 hover:bg-destructive/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-3",
            )}
          >
            <Bomb className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            <span className="hidden sm:inline">Destroy</span>
          </button>
        </div>
      </div>
    </header>
  )
}
