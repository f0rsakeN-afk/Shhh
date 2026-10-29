"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { client } from "@/lib/client"
import { useUsername } from "@/hooks/use-username"
import { LandingPage } from "@/components/landing-page"
import { MAX_ROOM_PARTICIPANTS } from "@/lib/room"

export default function CreateRoomPage() {
  const { username } = useUsername()
  const router = useRouter()

  const { mutate: createRoom, isPending } = useMutation({
    mutationFn: async () => {
      const res = await client.room.create.post()

      if (res.status === 200) {
        router.push(`/room/${res.data?.roomId}`)
      }
    },
  })

  const handleCreateRoom = useCallback(() => {
    createRoom()
  }, [createRoom])

  return (
    <LandingPage
      title="Create a private room"
      description={`One click opens a private room for up to ${MAX_ROOM_PARTICIPANTS} people. Share the link, say what you came to say, and let the timer do the cleaning.`}
      username={username}
      onCreateRoom={handleCreateRoom}
      isCreating={isPending}
    />
  )
}
