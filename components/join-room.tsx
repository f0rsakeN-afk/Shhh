"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { AlertCircle, ArrowRight, KeyRound } from "lucide-react"
import { client } from "@/lib/client"
import { useUsername } from "@/hooks/use-username"
import { UserAvatar } from "@/components/user-avatar"
import { Spinner } from "@/components/ui/spinner"
import { CreateRoomButton } from "@/components/create-room-button"
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
} from "@/components/ui/dialog"
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

interface JoinRoomContextValue {
  openJoin: () => void
}

const JoinRoomContext = createContext<JoinRoomContextValue | null>(null)

/**
 * Opens the join dialog from anywhere inside the provider. Returns null when
 * a subtree is rendered outside the marketing shell, so callers can opt in.
 */
export function useJoinRoom() {
  return useContext(JoinRoomContext)
}

export function JoinRoomProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  // Keeps the context value referentially stable so consumers do not re-render
  // on every parent render.
  const value = useMemo(() => ({ openJoin: () => setOpen(true) }), [])

  return (
    <JoinRoomContext.Provider value={value}>
      {children}
      <JoinRoomDialog open={open} onOpenChange={setOpen} />
    </JoinRoomContext.Provider>
  )
}

function JoinRoomDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
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
        throw new Error("This room is already full.")
      }

      return roomIdToCheck
    },
    onSuccess: (validRoomId) => {
      onOpenChange(false)
      router.push(`/room/${validRoomId}`)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const normalizedRoomId = normalizeRoomId(roomId)
  const isValid = NANOID_PATTERN.test(normalizedRoomId)
  const showFormatHint = Boolean(roomId.trim()) && !isValid && !error

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setError(null)
      onOpenChange(nextOpen)
    },
    [onOpenChange],
  )

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      setError(null)
      if (normalizedRoomId) checkAndJoin(normalizedRoomId)
    },
    [checkAndJoin, normalizedRoomId],
  )

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = normalizeRoomId(event.clipboardData.getData("text"))
      if (!pasted) return

      event.preventDefault()
      setRoomId(pasted)
      setError(null)

      if (NANOID_PATTERN.test(pasted)) {
        // Don't surprise people by navigating for them. Just get them one
        // keystroke away from joining.
        requestAnimationFrame(() => submitRef.current?.focus())
      }
    },
    [],
  )

  const handleRoomIdChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setRoomId(event.target.value)
      setError(null)
    },
    [],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup aria-describedby="join-room-description">
        <DialogHeader>
          <DialogTitle>Join a room</DialogTitle>
          <DialogDescription id="join-room-description">
            Paste an invite link or the 21-character room code. There&apos;s
            nothing to install.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="join-room-id"
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
                  id="join-room-id"
                  value={roomId}
                  onChange={handleRoomIdChange}
                  onPaste={handlePaste}
                  placeholder="Paste a link or room code"
                  className={cn(
                    "h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 font-mono text-sm tracking-tight text-foreground outline-none transition-colors duration-150 placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground",
                    "focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    error &&
                      "border-destructive/50 focus-visible:border-destructive/60",
                  )}
                  disabled={isJoining}
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={error ? "true" : "false"}
                  aria-describedby="join-room-help"
                />
              </div>

              {error ? (
                <div
                  id="join-room-help"
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
                  id="join-room-help"
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
                  <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </DialogPanel>

        <div className="border-t bg-muted/50 px-6 py-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-xs text-muted-foreground">
              Don&apos;t have a code yet?
            </p>
            <CreateRoomButton className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-line bg-background px-3 text-[13px] font-medium text-foreground shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto">
              Create a room instead
              <ArrowRight className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            </CreateRoomButton>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
