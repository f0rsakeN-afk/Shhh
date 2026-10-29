"use client"

import Link from "next/link"
import { Ghost, KeyRound, TimerReset, UserRound } from "lucide-react"
import { FlowShell } from "@/components/flow-shell"
import { UserAvatar } from "@/components/user-avatar"
import { Spinner } from "@/components/ui/spinner"
import { MAX_ROOM_PARTICIPANTS } from "@/lib/room"
import { cn } from "@/lib/utils"

interface LandingPageProps {
  title: string
  description: string
  username: string
  onCreateRoom: () => void
  isCreating: boolean
  createButtonText?: string
  creatingButtonText?: string
}

export function LandingPage({
  title,
  description,
  username,
  onCreateRoom,
  isCreating,
  createButtonText = "Create room",
  creatingButtonText = "Creating room…",
}: LandingPageProps) {
  return (
    <FlowShell
      asideTitle={
        <>
          A private space, <span className="text-brand">for one hour.</span>
        </>
      }
      asideDescription={description}
      points={[
        `Up to ${MAX_ROOM_PARTICIPANTS} people can join with one link.`,
        "The room is deleted after 60 minutes.",
        "You can end it early at any time.",
      ]}
    >
      <div className="surface-raised rounded-xl border border-line bg-card p-5 sm:p-7">
        <h1 className="text-balance text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
          Open a room and share the link. It closes automatically after one
          hour.
        </p>

        <div className="mt-6 flex items-center gap-3 rounded-lg border border-line bg-muted/40 px-3 py-3">
          <UserAvatar username={username} size="md" isCurrentUser />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Joining as</p>
            <p className="truncate text-sm font-medium">
              {username || "Generating your name…"}
            </p>
          </div>
          <Ghost
            className="size-4 shrink-0 text-muted-foreground"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>

        <ul className="mt-5 space-y-3">
          <li className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
            <TimerReset
              className="mt-0.5 size-4 shrink-0 text-brand"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            Self-destructs in one hour
          </li>
          <li className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
            <UserRound
              className="mt-0.5 size-4 shrink-0 text-brand"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            No account, email or profile
          </li>
          <li className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
            <KeyRound
              className="mt-0.5 size-4 shrink-0 text-brand"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            One link is all you need to invite
          </li>
        </ul>

        <button
          type="button"
          onClick={onCreateRoom}
          disabled={isCreating}
          aria-busy={isCreating}
          className={cn(
            "mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60",
          )}
        >
          {isCreating ? (
            <>
              {creatingButtonText}
              <Spinner className="size-4" />
            </>
          ) : (
            createButtonText
          )}
        </button>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          No account or setup required.
        </p>

        <Link
          href="/join"
          className="mt-4 block border-t border-line pt-4 text-center text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Have a code? Join a room instead
        </Link>
      </div>
    </FlowShell>
  )
}
