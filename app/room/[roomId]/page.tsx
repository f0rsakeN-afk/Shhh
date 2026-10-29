"use client"

import { useEffect, useState, useRef, useMemo, useCallback } from "react"
import { useUsername } from "@/hooks/use-username"
import { useSound } from "@/hooks/use-sound"
import { client } from "@/lib/client"
import { useRealtime } from "@/lib/realtime-client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { RoomHeader } from "@/components/room-header"
import { MessageList } from "@/components/message-list"
import { MessageInput } from "@/components/message-input"
import { TypingIndicator } from "@/components/typing-indicator"
import { PresenceIndicator } from "@/components/presence-indicator"
import { ConnectionNotification } from "@/components/connection-notification"
import { JoinRoomScreen } from "@/components/join-room-screen"
import { Spinner } from "@/components/ui/spinner"
import { toastSuccess } from "@/lib/toast"
import type { Message } from "@/lib/schemas"

const JOINED_STORAGE_KEY = (roomId: string) => `joined_${roomId}`

const Page = () => {
  const params = useParams()
  const roomId = params.roomId as string
  const router = useRouter()
  const { username } = useUsername()
  const playBombSound = useSound("/meme_bomb_sound.mp3")
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [realtimePresence, setRealtimePresence] = useState<{ username: string; status: "online" | "offline" | "away" } | null>(null)
  const [connectionNotification, setConnectionNotification] = useState<{ username: string; action: "joined" | "left" } | null>(null)
  const [hasJoined, setHasJoined] = useState<boolean>(false)
  const [joinedUsername, setJoinedUsername] = useState<string>(username)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const typingDebounceRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const autoCopiedRef = useRef(false)

  const { data: ttlData } = useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
      const res = await client.room.ttl.get({ query: { roomId } })
      return res.data
    },
  })

  const queryClient = useQueryClient()
  const { data: messages } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const res = await client.messages.get({ query: { roomId } })
      return res.data
    },
  })

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      await client.messages.post({ sender: joinedUsername, text }, { query: { roomId } })
    },
    onMutate: async ({ text }) => {
      await queryClient.cancelQueries({ queryKey: ["messages", roomId] })
      const previousMessages = queryClient.getQueryData<{ messages: Message[] }>(["messages", roomId])
      
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        sender: joinedUsername,
        text,
        timestamp: Date.now(),
        roomId,
        token: "current",
      }

      queryClient.setQueryData<{ messages: Message[] }>(["messages", roomId], (old) => {
        if (!old?.messages) return { messages: [optimisticMessage] }
        return { messages: [...old.messages, optimisticMessage] }
      })

      return { previousMessages }
    },
    onError: (err, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(["messages", roomId], context.previousMessages)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", roomId] })
    },
  })

  const cleanupRoom = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(JOINED_STORAGE_KEY(roomId))
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = undefined
    }
    
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current)
      typingDebounceRef.current = undefined
    }
    
    queryClient.removeQueries({ queryKey: ["messages", roomId] })
    queryClient.removeQueries({ queryKey: ["presence", roomId] })
    queryClient.removeQueries({ queryKey: ["ttl", roomId] })
    
    setTypingUsers([])
    setRealtimePresence(null)
    setConnectionNotification(null)
    setHasJoined(false)
  }, [roomId, queryClient])

  const { mutate: destroyRoom } = useMutation({
    mutationFn: async () => {
      await client.room.delete(null, { query: { roomId } })
    },
    onSuccess: () => {
      cleanupRoom()
      playBombSound()
      router.push("/?room=expired")
    },
  })

  const { mutate: joinRoom, isPending: isJoining } = useMutation({
    mutationFn: async () => {
      await client.room.join.post({ username }, { query: { roomId } })
    },
    onSuccess: () => {
      setJoinedUsername(username)
      setHasJoined(true)
      if (typeof window !== "undefined") {
        localStorage.setItem(JOINED_STORAGE_KEY(roomId), "true")
      }
    },
  })

  const { mutate: sendTyping } = useMutation({
    mutationFn: async ({ isTyping }: { isTyping: boolean }) => {
      await client.presence.typing.post({ username: joinedUsername, isTyping }, { query: { roomId } })
    },
  })

  const { mutate: sendHeartbeat } = useMutation({
    mutationFn: async (username: string) => {
      await client.presence.heartbeat.post({ username }, { query: { roomId } })
    },
  })

  const { mutate: addReaction } = useMutation({
    mutationFn: async ({ messageId, emoji, action }: { messageId: string; emoji: string; action: "add" | "remove" }) => {
      await client.messages.reaction.post({ messageId, emoji, username: joinedUsername, action }, { query: { roomId } })
    },
  })

  const { mutate: markAsRead } = useMutation({
    mutationFn: async (messageId: string) => {
      await client.messages.read.post({ messageId, username: joinedUsername }, { query: { roomId } })
    },
    onSuccess: (_, messageId) => {
      queryClient.setQueryData<{ messages: Message[] }>(["messages", roomId], (old) => {
        if (!old?.messages) return old
        return {
          messages: old.messages.map((msg) => {
            if (msg.id === messageId) {
              const readBy = msg.readBy || []
              if (!readBy.some((r) => r.username === joinedUsername)) {
                return {
                  ...msg,
                  readBy: [...readBy, { username: joinedUsername, timestamp: Date.now() }],
                }
              }
            }
            return msg
          }),
        }
      })
    },
  })

  const { mutate: deleteMessage } = useMutation({
    mutationFn: async (messageId: string) => {
      await client.messages.delete(null, { query: { roomId, messageId } })
    },
    onSuccess: (_, messageId) => {
      queryClient.setQueryData<{ messages: Message[] }>(["messages", roomId], (old) => {
        if (!old?.messages) return old
        return {
          messages: old.messages.map((msg) =>
            msg.id === messageId ? { ...msg, deleted: true, text: "" } : msg
          ),
        }
      })
    },
  })

  const { data: presenceData } = useQuery({
    queryKey: ["presence", roomId],
    queryFn: async () => {
      const res = await client.presence.get({ query: { roomId } })
      return res.data
    },
    refetchInterval: 30000,
    enabled: hasJoined,
  })

  useEffect(() => {
    if (typeof window !== "undefined") {
      const joined = localStorage.getItem(JOINED_STORAGE_KEY(roomId)) === "true"
      if (joined && username) {
        // Restoring a session from storage is a one-time sync with an external
        // system, not a render-driven update.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setJoinedUsername(username)
        setHasJoined(true)
      }
    }
  }, [roomId, username])

  useEffect(() => {
    if (!hasJoined || !joinedUsername) return

    sendHeartbeat(joinedUsername)
    
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat(joinedUsername)
    }, 30000)

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
    }
  }, [hasJoined, joinedUsername, roomId, sendHeartbeat])

  useEffect(() => {
    if (presenceData?.users && username && !hasJoined) {
      const userInRoom = presenceData.users.find((u) => u.username === username)
      if (userInRoom) {
        // The server already considers us joined after a reload, so adopt that
        // state instead of joining twice.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setJoinedUsername(username)
        setHasJoined(true)
        if (typeof window !== "undefined") {
          localStorage.setItem(JOINED_STORAGE_KEY(roomId), "true")
        }
      }
    }
  }, [presenceData, username, hasJoined, roomId])

  useEffect(() => {
    return () => {
      cleanupRoom()
    }
  }, [cleanupRoom])

  useEffect(() => {
    if (!hasJoined && username && roomId) {
      joinRoom()
    }
  }, [hasJoined, username, roomId, joinRoom])

  // Copy the invite once on entry so the link is ready to paste. Browsers can
  // reject clipboard access without a direct gesture, so this stays silent.
  useEffect(() => {
    if (!hasJoined || autoCopiedRef.current) return
    autoCopiedRef.current = true

    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return
    }

    const inviteUrl = `${window.location.origin}/room/${roomId}`

    void navigator.clipboard
      .writeText(inviteUrl)
      .then(() => {
        void toastSuccess({
          title: "Invite link copied",
          description: "Send it to the person you want in the room.",
        })
      })
      .catch(() => {
        // Clipboard access was denied. Sharing from the header still works.
      })
  }, [hasJoined, roomId])

  const computedOtherUser = useMemo(() => {
    if (!presenceData?.users) return null
    const other = presenceData.users.find((u) => u.username !== joinedUsername)
    return other ? { username: other.username, status: other.status } : null
  }, [presenceData, joinedUsername])

  // Realtime presence wins only when the polled snapshot has nobody to show.
  const otherUser = computedOtherUser ?? realtimePresence

  useRealtime({
    channels: [roomId],
    events: ["chat.message", "chat.destroy", "chat.typing", "chat.presence", "chat.connection", "chat.reaction"],
    onData: ({ event, data }) => {
      if (event === "chat.message") {
        queryClient.setQueryData<{ messages: Message[] }>(["messages", roomId], (old) => {
          if (!old?.messages) return old
          
          const messageWithToken: Message = { ...data, token: data.sender === joinedUsername ? "current" : undefined }
          
          if (data.sender === joinedUsername) {
            const existingIndex = old.messages.findIndex(
              (msg) => msg.id.startsWith("temp-") && msg.text === data.text && msg.sender === data.sender
            )
            
            if (existingIndex !== -1) {
              const updatedMessages = [...old.messages]
              updatedMessages[existingIndex] = messageWithToken
              return { messages: updatedMessages }
            }
          }
          
          const alreadyExists = old.messages.some(
            (msg) => msg.id === data.id || (msg.text === data.text && msg.sender === data.sender && Math.abs(msg.timestamp - data.timestamp) < 2000)
          )
          
          if (alreadyExists) {
            return old
          }
          
          return {
            messages: [...old.messages, messageWithToken],
          }
        })
      }

      if (event === "chat.destroy") {
        cleanupRoom()
        playBombSound()
        router.push("/?room=expired")
      }

      if (event === "chat.reaction") {
        queryClient.setQueryData<{ messages: Message[] }>(["messages", roomId], (old) => {
          if (!old?.messages) return old
          return {
            messages: old.messages.map((msg) => {
              if (msg.id === data.messageId) {
                const reactions = msg.reactions || []
                let updatedReactions = [...reactions]
                if (data.action === "add") {
                  if (!reactions.some((r) => r.emoji === data.emoji && r.username === data.username)) {
                    updatedReactions.push({ emoji: data.emoji, username: data.username, timestamp: Date.now() })
                  }
                } else {
                  updatedReactions = updatedReactions.filter(
                    (r) => !(r.emoji === data.emoji && r.username === data.username)
                  )
                }
                return { ...msg, reactions: updatedReactions }
              }
              return msg
            }),
          }
        })
      }

      if (event === "chat.typing" && data.username !== joinedUsername) {
        setTypingUsers((prev) => {
          if (data.isTyping) {
            return prev.includes(data.username) ? prev : [...prev, data.username]
          }
          return prev.filter((u) => u !== data.username)
        })
      }

      if (event === "chat.presence" && data.username !== joinedUsername) {
        setRealtimePresence({ username: data.username, status: data.status })
      }

      if (event === "chat.connection" && data.username !== joinedUsername) {
        setConnectionNotification({ username: data.username, action: data.action })
        setTimeout(() => setConnectionNotification(null), 3000)
      }
    },
  })

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current)
      }

      typingDebounceRef.current = setTimeout(() => {
        sendTyping({ isTyping })
      }, 300)
    },
    [sendTyping],
  )

  const handleExpire = useCallback(() => {
    cleanupRoom()
    playBombSound()
    router.push("/?room=expired")
  }, [cleanupRoom, playBombSound, router])

  const handleReaction = useCallback(
    (messageId: string, emoji: string, action: "add" | "remove") => {
      addReaction({ messageId, emoji, action })
    },
    [addReaction],
  )

  const handleMessageRead = useCallback(
    (messageId: string) => {
      markAsRead(messageId)
    },
    [markAsRead],
  )

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      deleteMessage(messageId)
    },
    [deleteMessage],
  )

  const handleJoin = useCallback(() => {
    joinRoom()
  }, [joinRoom])

  const handleDestroyRoom = useCallback(() => {
    destroyRoom()
  }, [destroyRoom])

  const handleSendMessage = useCallback(
    (text: string) => {
      sendMessage({ text })
    },
    [sendMessage],
  )

  const roomUrl = useMemo(
    () => (typeof window !== "undefined" ? window.location.href : ""),
    [],
  )

  if (!hasJoined || !username) {
    if (isJoining) {
      return (
        <main className="grid min-h-[100dvh] place-items-center bg-background p-6 text-foreground">
          <div className="flex flex-col items-center gap-4">
            <Spinner className="size-5 text-brand" />
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Joining room
            </p>
          </div>
        </main>
      )
    }
    return (
      <JoinRoomScreen
        roomId={roomId}
        username={username}
        onJoin={handleJoin}
        isJoining={isJoining}
      />
    )
  }

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <h1 className="sr-only">Private room {roomId}</h1>

      <RoomHeader
        roomId={roomId}
        timeToLive={ttlData?.ttl}
        onDestroy={handleDestroyRoom}
        onExpire={handleExpire}
        roomUrl={roomUrl}
      />

      <div className="flex flex-1 flex-col items-center overflow-hidden">
        <div className="border-line flex h-full w-full max-w-5xl flex-col md:border-x">
          {otherUser && (
            <div className="shrink-0 border-b border-line bg-card/30 px-3 py-2.5 sm:px-6">
              <PresenceIndicator
                username={otherUser.username}
                status={otherUser.status}
              />
            </div>
          )}

          {connectionNotification && (
            <ConnectionNotification
              username={connectionNotification.username}
              action={connectionNotification.action}
            />
          )}

          <MessageList
            messages={messages?.messages ?? []}
            currentUsername={joinedUsername}
            otherUsername={otherUser?.username}
            onReaction={handleReaction}
            onMessageRead={handleMessageRead}
            onDelete={handleDeleteMessage}
          />

          <TypingIndicator usernames={typingUsers} />

          <MessageInput
            onSend={handleSendMessage}
            onTyping={handleTyping}
            isPending={isPending}
          />
        </div>
      </div>
    </main>
  )
}

export default Page