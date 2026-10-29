"use client"

import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { client } from "@/lib/client"
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
      if (res.status === 200 && res.data?.roomId) {
        router.push(`/room/${res.data.roomId}`)
      }
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
