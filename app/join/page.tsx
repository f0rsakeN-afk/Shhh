"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { AlertCircle, ArrowRight, KeyRound } from "lucide-react"
import { FlowShell } from "@/components/flow-shell"
import { UserAvatar } from "@/components/user-avatar"
import { Spinner } from "@/components/ui/spinner"
import { useUsername } from "@/hooks/use-username"
import { client } from "@/lib/client"
import { MAX_ROOM_PARTICIPANTS } from "@/lib/room"
import { cn } from "@/lib/utils"

const NANOID_PATTERN = /^[A-Za-z0-9_-]{21}$/

/**
 * Accepts either a bare 21-character room code or a full invite link and
 * returns just the room id. Keeping this in one place means the form, the
 * error copy and the submit button always agree.
 */
function normalizeRoomId(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (NANOID_PATTERN.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    const segments = url.pathname.split("/").filter(Boolean)
    const fromPath = segments.findLast((segment) => NANOID_PATTERN.test(segment))
    if (fromPath) return fromPath
  } catch {
    // Not a URL, so fall through to a loose match for pasted text.
  }

  return trimmed.match(/[A-Za-z0-9_-]{21}/)?.[0] ?? trimmed
}

export default function JoinRoomPage() {
  const router = useRouter()
  const { username } = useUsername()
  const submitRef = useRef<HTMLButtonElement>(null)
  const [roomId, setRoomId] = useState("")
  const [error, setError] = useState<string | null>(null)

  const { mutate: checkAndJoin, isPending: isJoining } = useMutation({
    mutationFn: async (roomIdToCheck: string) => {
      if (!NANOID_PATTERN.test(roomIdToCheck)) {
        throw new Error("That room code doesn't look right.")
      }

      const res = await client.room.check.get({
        query: { roomId: roomIdToCheck },
      })

      if (!res.data?.exists) {
        throw new Error("This room is gone, or it never existed.")
      }

      if (res.data.isFull) {
        throw new Error(
          `This room already has ${MAX_ROOM_PARTICIPANTS} people in it.`,
        )
      }

      return roomIdToCheck
    },
    onSuccess: (validRoomId) => {
      router.push(`/room/${validRoomId}`)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const normalizedRoomId = normalizeRoomId(roomId)
  const isValid = NANOID_PATTERN.test(normalizedRoomId)
  const showFormatHint = Boolean(roomId.trim()) && !isValid && !error

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      if (normalizedRoomId) {
        checkAndJoin(normalizedRoomId)
      }
    },
    [checkAndJoin, normalizedRoomId],
  )

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = normalizeRoomId(e.clipboardData.getData("text"))
    if (!pasted) return

    e.preventDefault()
    setRoomId(pasted)
    setError(null)

    if (NANOID_PATTERN.test(pasted)) {
      // Don't surprise people by navigating for them. Just get them one
      // keystroke away from joining.
      requestAnimationFrame(() => submitRef.current?.focus())
    }
  }, [])

  const handleRoomIdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRoomId(e.target.value)
      setError(null)
    },
    [],
  )

  return (
    <FlowShell
      asideTitle={
        <>
          Join a <span className="text-brand">private room.</span>
        </>
      }
      asideDescription="Paste the link or code someone sent you. There is nothing to install, nothing to verify, and nothing left behind."
      points={[
        "Join in seconds with a generated name.",
        "Works in any browser, with no account.",
        "Everything disappears with the room.",
      ]}
    >
      <div className="surface-raised rounded-xl border border-line bg-card p-5 sm:p-7">
        <h1 className="text-balance text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
          Join a room
        </h1>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
          Paste an invite link or the 21-character room code. We&apos;ll take it
          from there.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="roomId"
                className="text-xs font-medium text-foreground"
              >
                Room code or invite link
              </label>
              <span
                className="w-14 text-right font-mono text-[11px] tabular-nums text-muted-foreground"
                aria-hidden="true"
              >
                {normalizedRoomId.length > 0 && !isValid
                  ? `${normalizedRoomId.length}/21`
                  : ""}
              </span>
            </div>

            <div className="relative">
              <KeyRound
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <input
                id="roomId"
                value={roomId}
                onChange={handleRoomIdChange}
                onPaste={handlePaste}
                placeholder="Paste a link or room code"
                className={cn(
                  "h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 font-mono text-sm tracking-tight text-foreground outline-none transition-colors duration-150 placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground",
                  "focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  error && "border-destructive/50 focus-visible:border-destructive/60",
                )}
                disabled={isJoining}
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={error ? "true" : "false"}
                aria-describedby="room-code-help"
              />
            </div>

            {error ? (
              <div
                id="room-code-help"
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/[0.06] px-3 py-2 text-xs leading-relaxed text-destructive-foreground"
              >
                <AlertCircle
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                {error}
              </div>
            ) : (
              <p
                id="room-code-help"
                className="text-xs leading-relaxed text-muted-foreground"
              >
                {showFormatHint
                  ? "Room codes are 21 characters: letters, numbers, underscores and hyphens. A full invite link works too."
                  : "Links and codes both work. Nothing is stored once you join."}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-line bg-muted/40 px-3 py-3">
            <UserAvatar username={username} size="md" isCurrentUser />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">You&apos;ll join as</p>
              <p className="truncate text-sm font-medium">
                {username || "Generating your name…"}
              </p>
            </div>
          </div>

          <button
            ref={submitRef}
            type="submit"
            disabled={!isValid || isJoining}
            aria-busy={isJoining}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60"
          >
            {isJoining ? (
              <>
                Joining room…
                <Spinner className="size-4" />
              </>
            ) : (
              <>
                Join room
                <ArrowRight
                  className="size-4"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </>
            )}
          </button>
        </form>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          No account · No history · No setup
        </p>

        <Link
          href="/create"
          className="mt-4 block border-t border-line pt-4 text-center text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Don&apos;t have a code? Create a room
        </Link>
      </div>
    </FlowShell>
  )
}
