"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { client } from "@/lib/client"
import { useUsername } from "@/hooks/use-username"
import { UserAvatar } from "./user-avatar"
import { cn } from "@/lib/utils"
import { MAX_ROOM_PARTICIPANTS } from "@/lib/room"
import { toastError, toastSuccess } from "@/lib/toast"

type AvatarName = string

interface SelectNameAvatorProps {
  roomId: string
  onSelect: (name: string, avatar: AvatarName) => void
  hasPreviousSelection?: boolean
}

// Avatars — emoji-based, zero image requests, on-brand
const AVATARS = ["🐵", "🐶", "🐱", "🐭", "🐰", "🐻", "🐧", "🐸", "🐙", "🐻‍💜"]

export function SelectNameAvator({ roomId, onSelect, hasPreviousSelection }: SelectNameAvatorProps) {
  const [name, setName] = useState("")
  const [avatarIndex, setAvatarIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { username } = useUsername()

  // Check for previous selection in room-specific localStorage
  useCallback(() => {
    if (hasPreviousSelection) return
    const storedName = localStorage.getItem(`selected_name_${roomId}`)
    const storedAvatar = localStorage.getItem(`selected_avatar_${roomId}`)
    if (storedName && storedAvatar !== null) {
      setName(storedName)
      setAvatarIndex(parseInt(storedAvatar))
    }
  }, [roomId, hasPreviousSelection])

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
    setError(null)
  }, [])

  const handleAvatarChange = useCallback((index: number) => {
    setAvatarIndex(index)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      setIsSubmitting(true)

      const trimmedName = name.trim()
      if (!trimmedName) {
        setError("Please enter a name")
        setIsSubmitting(false)
        return
      }

      if (trimmedName.length < 2) {
        setError("Name must be at least 2 characters")
        setIsSubmitting(false)
        return
      }

      // Store selection for future refreshes
      try {
        localStorage.setItem(`selected_name_${roomId}`, trimmedName)
        localStorage.setItem(`selected_avatar_${roomId}`, String(avatarIndex))
      } catch {
        // Ignore localStorage errors
      }

      onSelect(trimmedName, AVATARS[avatarIndex])
      router.push(`/room/${roomId}`)
    },
    [name, avatarIndex, roomId, onSelect, router],
  )

  return (
    <dialog>
      <form onSubmit={handleSubmit} className="space-y-6 p-8 max-w-md mx-auto">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Join {roomId}
          </h2>
          <p className="text-muted-foreground">
            Select your name and avatar to enter the room
          </p>
        </div>

        {/* Name input */}
        <div>
          <label
            htmlFor="room-name"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Your name
          </label>
          <input
            id="room-name"
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="Enter your name"
            className={cn(
              "h-11 w-full rounded-lg border border-input bg-background pl-3 pr-3 font-mono text-sm tracking-tight text-foreground outline-none transition-colors duration-150 placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60",
              error && "border-destructive/50 focus-visible:border-destructive/60",
            )}
            aria-invalid={!!error}
            aria-describedby="name-error"
            autoComplete="name"
            autoCapitalize="words"
            spellCheck={false}
          />
          {error && (
            <p id="name-error" role="alert" className="mt-1 text-sm text-destructive-foreground">
              {error}
            </p>
          )}
        </div>

        {/* Avatar grid */}
        <div className="grid grid-cols-4 gap-2 pt-4">
          {AVATARS.map((avatar, idx) => (
            <button
              key={avatar}
              type="button"
              onClick={() => setAvatarIndex(idx)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                avatarIndex === idx && "border-primary bg-primary/10 text-primary-foreground",
              )}
              aria-label={`Avatar ${avatar}`}
              aria-pressed={avatarIndex === idx}
            >
              {avatar}
            </button>
          ))}
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex-1 rounded-md border border-line bg-background px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-md border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60">
            {isSubmitting ? "Joining…" : "Join room"}
          </button>
        </div>
      </form>
    </dialog>
  )
}