"use client"

import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { client } from "@/lib/client"
import { toastError } from "@/lib/toast"
import { requireOk, isSessionStale } from "@/lib/api-error"
import { cn } from "@/lib/utils"

interface CreateRoomButtonProps {
  className?: string
  children: React.ReactNode
}

export function CreateRoomButton({ className, children }: CreateRoomButtonProps) {
  const router = useRouter()

  const { mutate: createRoom, isPending } = useMutation({
    mutationFn: async () => {
      const res = await client.room.create.post()
      return requireOk<{ roomId: string }>(res, "Could not create a room")
    },
    onSuccess: (data) => {
      router.push(`/room/${data.roomId}`)
    },
    onError: (err) => {
      toastError({
        title: isSessionStale(err) ? "Session expired" : "Could not create a room",
        description: isSessionStale(err)
          ? "Refresh the page and try again."
          : "Try again in a moment.",
      })
    },
  })

  return (
    <button
      type="button"
      onClick={() => createRoom()}
      disabled={isPending}
      className={cn(className)}
    >
      {isPending ? (
        <>
          Creating room…
          <Loader2 className="size-4 animate-spin" />
        </>
      ) : (
        children
      )}
    </button>
  )
}
