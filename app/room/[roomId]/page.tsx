"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Search, X } from "lucide-react"
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
import { toastError, toastSuccess } from "@/lib/toast"
import { requireOk, isSessionStale } from "@/lib/api-error"
import { notifyIfHidden } from "@/lib/notify"
import { cn } from "@/lib/utils"
import type { Message } from "@/lib/schemas"

/** What GET /messages returns; every setQueryData update must keep `hasMore`. */
interface MessageHistory {
  messages: Message[]
  hasMore: boolean
}

const JOINED_STORAGE_KEY = (roomId: string) => `joined_${roomId}`

const searchInputClasses =
  "h-9 w-full rounded-lg border border-input bg-background pl-9 pr-8 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"

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
  const [joinedAvatar, setJoinedAvatar] = useState<number | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const typingDebounceRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const autoCopiedRef = useRef(false)

  // The timer is seeded once at join and then server-locked by the heartbeat
  // (which returns the room TTL every 30s), so no focus or interval refetch.
  const { data: ttlData } = useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
      const res = await client.room.ttl.get({ query: { roomId } })
      return requireOk<{ ttl: number }>(res, "Could not load the room timer")
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const queryClient = useQueryClient()

  const cleanupRoom = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(JOINED_STORAGE_KEY(roomId))
      // The name/avatar selectors persist so a mid-session refresh does not
      // force a re-join; once the room is intentionally left or destroyed,
      // both selections go with it.
      localStorage.removeItem(`selected_name_${roomId}`)
      localStorage.removeItem(`selected_avatar_${roomId}`)
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
    setEditing(null)
    setHasJoined(false)
  }, [roomId, queryClient])

  // Recent tail of the transcript; older pages are user-fetched and kept in
  // local state so prepend-anchor scrolling never re-triggers a query.
  const { data: messages } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const res = await client.messages.get({ query: { roomId, limit: 100 } })

      // A history read can 401 when the proxy has recycled our token; drop
      // back to the join screen (fresh token is issued on the next load).
      if (res.error && res.status === 401) {
        cleanupRoom()
        return undefined
      }

      return requireOk<{ messages: Message[]; hasMore: boolean }>(res, "Could not load messages")
    },
  })

  const [olderMessages, setOlderMessages] = useState<Message[]>([])
  // Tri-state: null means "never paged, defer to the recent tail's hasMore";
  // once a real page comes back its result is authoritative, so the button
  // hides cleanly instead of flapping between server and cached truth.
  const [hasOlderMessages, setHasOlderMessages] = useState<boolean | null>(null)
  const [isEarlierLoading, setIsEarlierLoading] = useState(false)

  const loadEarlierMessages = useCallback(async () => {
    if (isEarlierLoading) return
    setIsEarlierLoading(true)

    try {
      const cursorMessages = messages?.messages ?? []
      const oldestTimestamp = olderMessages[0]?.timestamp ?? cursorMessages[0]?.timestamp
      if (oldestTimestamp === undefined) {
        setHasOlderMessages(false)
        return
      }

      const res = await client.messages.get({
        query: { roomId, limit: 100, before: oldestTimestamp },
      })

      // A history read can 401 when the proxy has recycled our token; drop
      // back to the join screen (fresh token is issued on the next load).
      if (res.error && res.status === 401) {
        cleanupRoom()
        return
      }

      const page = requireOk<{ messages: Message[]; hasMore: boolean }>(
        res,
        "Could not load earlier messages",
      )

      setOlderMessages((prev) => {
        const seen = new Set(prev.map((message) => message.id))
        // Pages walk newest-first; the transcript is oldest-first.
        const pageOldestFirst = page.messages.filter(
          (message) => !seen.has(message.id),
        )
        return [...pageOldestFirst, ...prev]
      })
      setHasOlderMessages(page.hasMore)
    } catch {
      toastError({
        title: "Could not load earlier messages",
        description: "Try again in a moment.",
      })
    } finally {
      setIsEarlierLoading(false)
    }
  }, [isEarlierLoading, olderMessages, messages, roomId, cleanupRoom])

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      const res = await client.messages.post(
        { sender: joinedUsername, text, avatar: joinedAvatar },
        { query: { roomId } },
      )
      return requireOk<{ success: boolean }>(res, "Message failed to send")
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
        avatar: joinedAvatar,
        token: "current",
      }

      queryClient.setQueryData<MessageHistory>(["messages", roomId], (old) => {
        if (!old?.messages) return { messages: [optimisticMessage], hasMore: false }
        return { messages: [...old.messages, optimisticMessage], hasMore: old.hasMore }
      })

      return { previousMessages }
    },
    onError: (err, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(["messages", roomId], context.previousMessages)
      }
      // Surface the undelivered text so nothing feels silently swallowed.
      toastError({
        title: isSessionStale(err)
          ? "Session expired"
          : "Message failed to send",
        description: isSessionStale(err)
          ? "Refresh the page to rejoin and send again."
          : variables.text.length > 80
            ? `${variables.text.slice(0, 80)}…`
            : variables.text,
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", roomId] })
    },
  })

  const { mutate: editMessage, isPending: isEditingPending } = useMutation({
    mutationFn: async ({ messageId, text }: { messageId: string; text: string }) => {
      const res = await client.messages.edit.post({ messageId, text }, { query: { roomId } })
      return requireOk<{ success: boolean }>(res, "Could not save the edit")
    },
    onError: (err) => {
      // The editing banner stays open so the user can simply retry.
      toastError({
        title: isSessionStale(err)
          ? "Session expired"
          : "Could not save the edit",
        description: isSessionStale(err)
          ? "Refresh the page to rejoin, then try again."
          : "The message is unchanged; you can retry.",
      })
    },
    onSuccess: (_, { messageId, text }) => {
      queryClient.setQueryData<MessageHistory>(["messages", roomId], (old) => {
        if (!old?.messages) return old
        return {
          messages: old.messages.map((msg) =>
            msg.id === messageId ? { ...msg, text, edited: true } : msg,
          ),
          hasMore: old.hasMore,
        }
      })
      setEditing(null)
    },
  })

  const { mutate: destroyRoom } = useMutation({
    mutationFn: async () => {
      const res = await client.room.delete(null, { query: { roomId } })
      return requireOk<{ success: boolean }>(res, "Could not destroy the room")
    },
    onSuccess: () => {
      cleanupRoom()
      playBombSound()
      router.push("/?room=expired")
    },
    onError: (err) => {
      toastError({
        title: isSessionStale(err) ? "Session expired" : "Could not destroy the room",
        description: isSessionStale(err)
          ? "Refresh the page to rejoin, then try again."
          : undefined,
      })
    },
  })

  const { mutate: joinRoom, isPending: isJoining } = useMutation({
    mutationFn: async ({ username: name, avatar }: { username: string; avatar: number }) => {
      const res = await client.room.join.post({ username: name, avatar }, { query: { roomId } })
      return requireOk<{ success: boolean }>(res, "Could not enter the room")
    },
    onSuccess: (_, { username: name, avatar }) => {
      setJoinedUsername(name)
      setJoinedAvatar(avatar)
      setHasJoined(true)
    },
    onError: (err) => {
      toastError({
        title: isSessionStale(err)
          ? "Your invite slot expired"
          : "Could not enter the room",
        description: isSessionStale(err)
          ? "Someone may have taken the slot. Refresh the page for a new one."
          : undefined,
      })
    },
  })

  const { mutate: sendTyping } = useMutation({
    mutationFn: async ({ isTyping }: { isTyping: boolean }) => {
      // Presence signals are best-effort; failures stay silent.
      await client.presence.typing.post({ isTyping }, { query: { roomId } })
    },
  })

  const { mutate: sendHeartbeat } = useMutation({
    mutationFn: async () => {
      // Identity comes from the auth cookie server-side now. Deliberately
      // quiet: a transient heartbeat failure must not toast on a 30s poll,
      // presence-visible status recovers with the next beat.
      const res = await client.presence.heartbeat.post(null, { query: { roomId } })
      return res.data && "ttl" in res.data ? res.data.ttl : undefined
    },
    // The heartbeat already carries the room TTL; feeding it to the timer
    // cache keeps the countdown server-locked for free.
    onSuccess: (ttl) => {
      if (typeof ttl === "number") {
        queryClient.setQueryData<{ ttl: number }>(["ttl", roomId], { ttl })
      }
    },
  })

  const { mutate: addReaction } = useMutation({
    mutationFn: async ({ messageId, emoji, action }: { messageId: string; emoji: string; action: "add" | "remove" }) => {
      const res = await client.messages.reaction.post({ messageId, emoji, action }, { query: { roomId } })
      return requireOk<{ success: boolean }>(res, "Reaction failed")
    },
    // One chip click feels instant; the server's full-state
    // chat.reaction event then assigns the truth over this local intent,
    // so a lost update is a briefly-mirrored chip instead of a broken one.
    onMutate: async ({ messageId, emoji, action }) => {
      await queryClient.cancelQueries({ queryKey: ["messages", roomId] })
      const previous = queryClient.getQueryData<MessageHistory>(["messages", roomId])

      queryClient.setQueryData<MessageHistory>(["messages", roomId], (old) => {
        if (!old?.messages) return old
        return {
          messages: old.messages.map((msg) => {
            if (msg.id !== messageId) return msg
            // Mirror the server invariant locally: exactly one reaction per
            // user per message. "add" replaces anything this user had.
            const withoutMine = (msg.reactions || []).filter(
              (r) => r.username !== joinedUsername,
            )
            const reactions =
              action === "add"
                ? [...withoutMine, { emoji, username: joinedUsername, timestamp: Date.now() }]
                : withoutMine
            return { ...msg, reactions }
          }),
          hasMore: old.hasMore,
        }
      })

      return { previous }
    },
    onError: (err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["messages", roomId], context.previous)
      }
      toastError({
        title: isSessionStale(err) ? "Session expired" : "Reaction failed",
        description: isSessionStale(err)
          ? "Refresh the page to rejoin, then try again."
          : "Your chip stays as-is. Try again.",
      })
    },
  })

  const { mutate: markAsRead } = useMutation({
    mutationFn: async (messageId: string) => {
      // Receipts are server-attributed; the username no longer travels here.
      await client.messages.read.post({ messageId }, { query: { roomId } })
    },
    onSuccess: (_, messageId) => {
      queryClient.setQueryData<MessageHistory>(["messages", roomId], (old) => {
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
          hasMore: old.hasMore,
        }
      })
    },
  })

  const { mutate: deleteMessage } = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await client.messages.delete(null, { query: { roomId, messageId } })
      return requireOk<{ success: boolean }>(res, "Could not delete the message")
    },
    onError: (err) => {
      toastError({
        title: isSessionStale(err) ? "Session expired" : "Could not delete the message",
        description: isSessionStale(err)
          ? "Refresh the page to rejoin, then try again."
          : "The message is untouched; try again.",
      })
    },
    onSuccess: (_, messageId) => {
      queryClient.setQueryData<MessageHistory>(["messages", roomId], (old) => {
        if (!old?.messages) return old
        return {
          messages: old.messages.map((msg) =>
            msg.id === messageId ? { ...msg, deleted: true, text: "" } : msg,
          ),
          hasMore: old.hasMore,
        }
      })
      setEditing((current) => (current?.id === messageId ? null : current))
    },
  })

  const { data: presenceData } = useQuery({
    queryKey: ["presence", roomId],
    queryFn: async () => {
      const res = await client.presence.get({ query: { roomId } })
      return requireOk<{ users: Array<{ username: string; status: "online" | "offline"; lastSeen: number; avatar?: number }> }>(
        res,
        "Could not load participants",
      )
    },
    refetchInterval: 60000, // Live updates arrive via chat.presence events; this is just a missed-event safety net.
    enabled: hasJoined,
  })

  // On the first mount, restore the room-specific name/avatar selection and
  // continue the session silently when it exists.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const storedName = localStorage.getItem("selected_name_" + roomId)
    const storedAvatar = localStorage.getItem("selected_avatar_" + roomId)

    if (storedName && storedAvatar !== null) {
      const parsedAvatar = parseInt(storedAvatar, 10)
      if (!Number.isNaN(parsedAvatar) && parsedAvatar >= 0 && parsedAvatar <= 9) {
        setJoinedAvatar(parsedAvatar)
      }
      setJoinedUsername(storedName)
      setHasJoined(true)
      try { localStorage.setItem("chat_username", storedName) } catch {}
    }
  }, [roomId])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hasJoined || !joinedUsername) return

    sendHeartbeat()

    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat()
    }, 30000)

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
    }
  }, [hasJoined, joinedUsername, roomId, sendHeartbeat])

  useEffect(() => {
    return () => {
      cleanupRoom()
    }
  }, [cleanupRoom])

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

  // Keyboard shortcuts: "/" focuses search (when not typing in a field).
  useEffect(() => {
    if (!hasJoined) return

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
      return target.isContentEditable
    }

    const handler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || event.repeat) return

      const plainSlash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey
      const cmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k"

      if (plainSlash || cmdK) {
        event.preventDefault()
        setSearchOpen(true)
        requestAnimationFrame(() => searchInputRef.current?.focus())
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [hasJoined])

  const computedOtherUser = useMemo(() => {
    if (!presenceData?.users) return null
    const other = presenceData.users.find((u) => u.username !== joinedUsername)
    return other ? { username: other.username, status: other.status } : null
  }, [presenceData, joinedUsername])

  // Realtime presence wins only when the polled snapshot has nobody to show.
  const otherUser = computedOtherUser ?? realtimePresence

  const participants = useMemo(() => {
    const names = new Set<string>()
    if (joinedUsername) names.add(joinedUsername)
    presenceData?.users?.forEach((u) => {
      if (u.username) names.add(u.username)
    })
    return Array.from(names)
  }, [joinedUsername, presenceData])

  // Stable array identity even while the query is loading, so downstream
  // hooks (filtering, search, edit lookup) do not re-run per render. Older
  // prepended pages merge in front of the recent tail.
  const allMessages = useMemo(
    () => [...olderMessages, ...(messages?.messages ?? [])],
    [olderMessages, messages?.messages],
  )
  const hasEarlierMessages = useMemo(
    () => hasOlderMessages ?? Boolean(messages?.hasMore),
    [hasOlderMessages, messages?.hasMore],
  )

  const filteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return allMessages
    return allMessages.filter((msg) => {
      if (msg.deleted) return false
      return (
        msg.text.toLowerCase().includes(query) ||
        msg.sender.toLowerCase().includes(query)
      )
    })
  }, [allMessages, searchQuery])

  const searchNotice = useMemo(() => {
    if (!searchQuery.trim()) return null
    return `${filteredMessages.length} of ${allMessages.filter((m) => !m.deleted).length} message(s) match "${searchQuery.trim()}"`
  }, [filteredMessages, allMessages, searchQuery])

  const lastOwnMessageId = useMemo(() => {
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msg = allMessages[i]
      if (
        msg.sender === joinedUsername &&
        !msg.deleted &&
        msg.text &&
        !msg.id.startsWith("temp-")
      ) {
        return msg.id
      }
    }
    return null
  }, [allMessages, joinedUsername])

  useRealtime({
    channels: [roomId],
    events: ["chat.message", "chat.destroy", "chat.typing", "chat.presence", "chat.connection", "chat.reaction", "chat.edited"],
    onData: ({ event, data }) => {
      if (event === "chat.message") {
        if (data.sender !== joinedUsername && typeof data.text === "string" && data.text) {
          notifyIfHidden(data.sender, data.text)
        }

        queryClient.setQueryData<MessageHistory>(["messages", roomId], (old) => {
          if (!old?.messages) return old

          const messageWithToken: Message = { ...data, token: data.sender === joinedUsername ? "current" : undefined }

          if (data.sender === joinedUsername) {
            const existingIndex = old.messages.findIndex(
              (msg) => msg.id.startsWith("temp-") && msg.text === data.text && msg.sender === data.sender
            )

            if (existingIndex !== -1) {
              const updatedMessages = [...old.messages]
              updatedMessages[existingIndex] = messageWithToken
              return { messages: updatedMessages, hasMore: old.hasMore }
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
            hasMore: old.hasMore,
          }
        })
      }

      if (event === "chat.destroy") {
        cleanupRoom()
        playBombSound()
        router.push("/?room=expired")
      }

      if (event === "chat.edited") {
        queryClient.setQueryData<MessageHistory>(["messages", roomId], (old) => {
          if (!old?.messages) return old
          return {
            messages: old.messages.map((msg) =>
              msg.id === data.messageId
                ? { ...msg, text: data.text, edited: true }
                : msg,
            ),
            hasMore: old.hasMore,
          }
        })
      }

      if (event === "chat.reaction") {
        // Server-authoritative full state: assign, never merge, so every
        // client converges even under racing clicks.
        queryClient.setQueryData<MessageHistory>(["messages", roomId], (old) => {
          if (!old?.messages) return old
          return {
            messages: old.messages.map((msg) =>
              msg.id === data.messageId
                ? { ...msg, reactions: data.reactions }
                : msg,
            ),
            hasMore: old.hasMore,
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

  const handleStartEdit = useCallback(
    (messageId: string) => {
      const target = allMessages.find((msg) => msg.id === messageId)
      if (!target || target.deleted) return
      setEditing({ id: target.id, text: target.text })
    },
    [allMessages],
  )

  const handleEditLastRequest = useCallback(() => {
    if (!lastOwnMessageId) return
    const target = allMessages.find((msg) => msg.id === lastOwnMessageId)
    if (!target) return
    setEditing({ id: target.id, text: target.text })
  }, [allMessages, lastOwnMessageId])

  const handleSaveEdit = useCallback(
    (text: string) => {
      if (isEditingPending || !editing) return
      editMessage({ messageId: editing.id, text })
    },
    [editMessage, editing, isEditingPending],
  )

  const handleCancelEdit = useCallback(() => {
    setEditing(null)
  }, [])

  const handleJoin = useCallback(
    (name: string, avatarIndex: number) => {
      // Persist the room-specific identity first, so a reload at any moment
      // in the join handshake still restores the same look.
      try {
        localStorage.setItem("selected_name_" + roomId, name)
        localStorage.setItem("selected_avatar_" + roomId, String(avatarIndex))
        localStorage.setItem("chat_username", name)
      } catch {}

      joinRoom({ username: name, avatar: avatarIndex })
    },
    [joinRoom, roomId],
  )

  const clearSearch = useCallback(() => {
    setSearchQuery("")
    searchInputRef.current?.focus()
  }, [])

  const closeSearch = useCallback(() => {
    setSearchQuery("")
    setSearchOpen(false)
  }, [])

  const toggleSearch = useCallback(() => {
    setSearchOpen((open) => {
      if (!open) {
        // Focus lands on the input the moment it mounts.
        requestAnimationFrame(() => searchInputRef.current?.focus())
      } else {
        setSearchQuery("")
      }
      return !open
    })
  }, [])

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

  if (!hasJoined) {
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
        suggestedName={username}
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
          {presenceData?.users && (
            <div className="shrink-0 border-b border-line bg-card/30 px-3 py-2.5 sm:px-6">
              <div className="mx-auto flex w-full items-center gap-2">
                <div className="min-w-0 flex-1">
                  <PresenceIndicator
                    username={joinedUsername}
                    status="online"
                    participants={presenceData.users.map((u) => (
                      {
                        username: u.username,
                        status: u.status,
                        avatar: u.avatar,
                      }
                    ))}
                  />
                </div>

                <button
                  type="button"
                  onClick={toggleSearch}
                  aria-expanded={searchOpen}
                  aria-controls="room-search"
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-2.5",
                    searchOpen
                      ? "border-brand/40 bg-brand-soft text-brand"
                      : "border-line text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {searchOpen ? (
                    <>
                      <X className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                      <span className="hidden sm:inline">Close</span>
                    </>
                  ) : (
                    <>
                      <Search className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                      <span className="hidden sm:inline">Search</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {connectionNotification && (
            <ConnectionNotification
              username={connectionNotification.username}
              action={connectionNotification.action}
            />
          )}

          {/* Search row: exists only while open, so messages keep the space */}
          {searchOpen && (
            <div id="room-search" className="shrink-0 border-b border-line px-3 py-2 sm:px-6">
              <div className="relative mx-auto w-full">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  role="searchbox"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault()
                      closeSearch()
                    }
                  }}
                  placeholder="Search this conversation…"
                  aria-label="Search messages"
                  aria-describedby="search-results-status"
                  className={searchInputClasses}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                  </button>
                )}
              </div>
              <p
                id="search-results-status"
                role="status"
                aria-live="polite"
                className={searchQuery ? "mt-1 px-1 text-[11px] text-muted-foreground" : "sr-only"}
              >
                {searchNotice ?? ""}
              </p>
            </div>
          )}

          <MessageList
            messages={filteredMessages}
            currentUsername={joinedUsername}
            otherUsername={otherUser?.username}
            onReaction={handleReaction}
            onMessageRead={handleMessageRead}
            onDelete={handleDeleteMessage}
            onEdit={handleStartEdit}
            emptyNotice={searchNotice}
            hasEarlierMessages={!searchQuery && hasEarlierMessages}
            onLoadEarlier={loadEarlierMessages}
            isEarlierLoading={isEarlierLoading}
          />

          <TypingIndicator usernames={typingUsers} />

          <MessageInput
            onSend={handleSendMessage}
            onTyping={handleTyping}
            isPending={isPending}
            participants={participants}
            editing={editing}
            onCancelEdit={handleCancelEdit}
            onEditSave={handleSaveEdit}
            onEditLastRequest={handleEditLastRequest}
          />
        </div>
      </div>
    </main>
  )
}

export default Page
