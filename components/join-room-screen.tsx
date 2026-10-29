"use client"

import { ArrowLeft, ArrowRight, Clock3, KeyRound } from "lucide-react"
import Link from "next/link"
import { FlowShell } from "@/components/flow-shell"
import { UserAvatar } from "@/components/user-avatar"
import { Spinner } from "@/components/ui/spinner"
import { MAX_ROOM_PARTICIPANTS } from "@/lib/room"

interface JoinRoomScreenProps {
  roomId: string
  username: string
  onJoin: () => void
  isJoining: boolean
}

export function JoinRoomScreen({
  roomId,
  username,
  onJoin,
  isJoining,
}: JoinRoomScreenProps) {
  return (
    <FlowShell
      asideTitle={
        <>
          You were <span className="text-brand">invited in.</span>
        </>
      }
      asideDescription={`This is a private room for up to ${MAX_ROOM_PARTICIPANTS} people. Your identity is generated on the spot, and the room disappears an hour after it was created.`}
      points={[
        "No account or profile is created.",
        "The room closes 60 minutes after it opens.",
        "Nothing is saved once it closes.",
      ]}
    >
      <div className="surface-raised rounded-xl border border-line bg-card p-5 sm:p-7">
        <h1 className="text-balance text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
          Join the room
        </h1>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
          You were invited to a private conversation. It won&apos;t be here for
          long.
        </p>

        <div className="mt-6 overflow-hidden rounded-lg border border-line bg-muted/30">
          <div className="flex items-center gap-3 px-3 py-3">
            <UserAvatar username={username} size="md" isCurrentUser />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Joining as</p>
              <p className="truncate text-sm font-medium">
                {username || "Generating your name…"}
              </p>
            </div>
          </div>

          <div className="border-t border-line bg-background/40 px-3 py-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <KeyRound
                className="size-3"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              Room code
            </div>
            <p className="mt-1 break-all font-mono text-xs leading-relaxed text-foreground/80">
              {roomId}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs leading-relaxed text-warning-foreground">
          <Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            The room erases itself when the timer ends. Up to{" "}
            {MAX_ROOM_PARTICIPANTS} people can be inside at once.
          </span>
        </div>

        <button
          type="button"
          onClick={onJoin}
          disabled={isJoining}
          aria-busy={isJoining}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60"
        >
          {isJoining ? (
            <>
              Joining…
              <Spinner className="size-4" />
            </>
          ) : (
            <>
              Enter room
              <ArrowRight
                className="size-4"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </>
          )}
        </button>

        <Link
          href="/"
          className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Back to home
        </Link>
      </div>
    </FlowShell>
  )
}
