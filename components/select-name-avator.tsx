"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"

export function SelectNameAvator({ roomId, onSelect, hasPreviousSelection }: {
  roomId: string
  onSelect: (name: string, avatar: string) => void
  hasPreviousSelection?: boolean
}) {
  const [name, setName] = useState("")
  const [avatarIndex, setAvatarIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

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

      onSelect(name, ["🐵", "🐶", "🐱", "🐭", "🐰", "🐻", "🐧", "🐸", "🐙", "🐻‍💜"][avatarIndex])
      router.push(`/room/${roomId}`)
    },
    [name, avatarIndex, roomId, onSelect, router],
  )

  return (
    <div>
      <h3>Join {roomId}</h3>
      <p>Select your name and avatar to enter the room</p>
      <input
        value={name}
        onChange={handleNameChange}
        placeholder="Enter your name"
      />
      <button onClick={() => router.push("/")}>Cancel</button>
      <button onClick={() => router.push(`/room/${roomId}`)}>Join</button>
    </div>
  )
}