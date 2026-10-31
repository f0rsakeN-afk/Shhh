"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Clock3,
  KeyRound,
} from "lucide-react"
import { AmbientBackdrop } from "@/components/ambient-backdrop"
import { Spinner } from "@/components/ui/spinner"
import { UserAvatar } from "@/components/user-avatar"
import { requestNotificationPermission } from "@/lib/notify"
import { AVATAR_EMOJIS } from "@/lib/user-colors"
import { MAX_ROOM_PARTICIPANTS, ROOM_TTL_SECONDS } from "@/lib/room"
import { sanitizeUsername } from "@/lib/sanitize"
import { cn } from "@/lib/utils"

interface JoinRoomScreenProps {
  roomId: string
  /** Sanitized prefill from the generated anonymous name, if any. */
  suggestedName?: string
  onJoin: (name: string, avatarIndex: number) => void
  isJoining: boolean
}

const NAME_MIN = 2
const NAME_MAX = 24

export function JoinRoomScreen({
  roomId,
  suggestedName = "",
  onJoin,
  isJoining,
}: JoinRoomScreenProps) {
  const router = useRouter()
  const initialName = sanitizeUsername(suggestedName).slice(0, NAME_MAX)
  const [name, setName] = useState(initialName)
  const [avatarIndex, setAvatarIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setName(event.target.value)
      setError(null)
    },
    [],
  )

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      setError(null)

      const cleaned = sanitizeUsername(name).trim()
      if (cleaned.length < NAME_MIN) {
        setError(`Name needs at least ${NAME_MIN} characters.`)
        return
      }

      // Notifications need a permission ask inside a user gesture. The
      // enter button is the natural moment; it never blocks the flow.
      requestNotificationPermission()

      onJoin(cleaned, avatarIndex)
    },
    [name, avatarIndex, onJoin],
  )

  return (
    <main
      id="main-content"
      className="relative flex min-h-[100dvh] flex-col overflow-x-clip bg-background text-foreground"
    >
      <AmbientBackdrop variant="hero" className="opacity-60" />

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <div className="surface-raised rounded-xl border border-line bg-card p-5 sm:p-7">
          {/* Room strip */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-muted/40 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-md border border-line bg-background text-brand">
                <KeyRound className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Room code</p>
                <p className="truncate font-mono text-xs leading-none text-foreground">
                  {roomId}
                </p>
              </div>
            </div>

            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 font-mono text-[11px] tabular-nums text-warning-foreground">
              <Clock3 className="size-3" aria-hidden="true" />
              {Math.round(ROOM_TTL_SECONDS / 60)} min
            </span>
          </div>

          <h1 className="mt-5 text-balance text-2xl font-semibold tracking-[-0.025em] sm:text-[1.6rem]">
            Pick a look, step inside
          </h1>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
            Your name and avatar stay in this room only. {MAX_ROOM_PARTICIPANTS}{" "}
            people max, and everything disappears when the timer ends.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            {/* Live preview */}
            <div className="flex items-center gap-3 rounded-lg border border-line bg-background px-3 py-3">
              <UserAvatar username={name} avatar={avatarIndex} size="lg" isCurrentUser />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Joining as</p>
                <p className="truncate text-sm font-medium">
                  {sanitizeUsername(name).trim() || "Your name here"}
                </p>
              </div>
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground/40"
                aria-hidden="true"
              />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <label
                htmlFor="join-name"
                className="block text-xs font-medium text-foreground"
              >
                Name
              </label>
              <input
                id="join-name"
                value={name}
                onChange={handleNameChange}
                maxLength={NAME_MAX}
                placeholder="e.g. Sunnth"
                autoComplete="off"
                spellCheck={false}
                disabled={isJoining}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "join-name-error" : "join-name-help"}
                className={cn(
                  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground",
                  "focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  error && "border-destructive/50 focus-visible:border-destructive/60",
                )}
              />
              {error ? (
                <p
                  id="join-name-error"
                  role="alert"
                  className="flex items-start gap-1.5 text-xs leading-relaxed text-destructive-foreground"
                >
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              ) : (
                <p id="join-name-help" className="text-xs leading-relaxed text-muted-foreground">
                  {NAME_MIN} to {NAME_MAX} characters. Emojis and symbols are stripped
                  automatically.
                </p>
              )}
            </div>

            {/* Avatar picker */}
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-foreground">Avatar</legend>
              <div
                role="radiogroup"
                aria-label="Pick your avatar"
                className="grid grid-cols-5 gap-2"
              >
                {AVATAR_EMOJIS.map((emoji, index) => {
                  const selected = avatarIndex === index
                  return (
                    <button
                      key={emoji}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Avatar ${index + 1}: ${emoji}`}
                      disabled={isJoining}
                      onClick={() => setAvatarIndex(index)}
                      className={cn(
                        "grid aspect-square place-items-center rounded-lg border text-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        selected
                          ? "border-brand bg-brand-soft shadow-[0_0_0_1px] shadow-brand/30"
                          : "border-line bg-muted/30 hover:border-foreground/20 hover:bg-accent",
                      )}
                    >
                      <span aria-hidden="true">{emoji}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={isJoining}
              aria-busy={isJoining}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60"
            >
              {isJoining ? (
                <>
                  Entering…
                  <Spinner className="size-4" />
                </>
              ) : (
                <>
                  Enter room
                  <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={isJoining}
          >
            <ArrowLeft className="size-3" aria-hidden="true" />
            Back to home
          </button>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
          The room erases itself when the timer ends, messages included.
        </p>
      </div>
    </main>
  )
}
