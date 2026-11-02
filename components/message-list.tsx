"use client"

import { memo, useCallback, useEffect, useRef, useState } from "react"
import { ArrowDown, ChevronUp, MessageCircle, SearchX } from "lucide-react"
import { format } from "date-fns"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { MessageItem } from "./message-item"
import { Message } from "@/lib/schemas"

interface MessageListProps {
  messages: Message[]
  currentUsername: string
  otherUsername?: string
  onReaction?: (messageId: string, emoji: string, action: "add" | "remove") => void
  onMessageRead?: (messageId: string) => void
  onDelete?: (messageId: string) => void
  onEdit?: (messageId: string) => void
  /** Shown while search filtering hides most messages. */
  emptyNotice?: string | null
  /** Whether older pages are still available above the rendered history. */
  hasEarlierMessages?: boolean
  /** Prepends the previous hour's page; the list keeps the scroll anchor. */
  onLoadEarlier?: () => void
  isEarlierLoading?: boolean
}

/** Human day label for separators: "Today" / "Yesterday" / "March 4". */
function formatSeparationDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  if (date.toDateString() === now.toDateString()) return "Today"
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return format(date, "MMMM d")
}

export const MessageList = memo(function MessageList({
  messages,
  currentUsername,
  otherUsername,
  onReaction,
  onMessageRead,
  onDelete,
  onEdit,
  emptyNotice = null,
  hasEarlierMessages = false,
  onLoadEarlier,
  isEarlierLoading = false,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const readMessagesRef = useRef<Set<string>>(new Set())
  // Stable per-id ref callbacks: an inline closure is a fresh identity every
  // render, so React detaches and reattaches every row's ref on each render
  // (detach → null write → delete from the map → attach → set). The factory
  // memoizes one callback per id for the row's lifetime.
  const refCallbacksRef = useRef<Map<string, (el: HTMLDivElement | null) => void>>(
    new Map(),
  )
  const [animatedMessages, setAnimatedMessages] = useState<Set<string>>(new Set())
  // Set when a message lands while the reader is scrolled away; cleared by
  // clicking the jump pill or by scrolling back near the bottom.
  const [hasUnseenBelow, setHasUnseenBelow] = useState(false)

  /** Distance in px under which the viewport counts as "at the bottom". */
  const NEAR_BOTTOM_PX = 160

  const findViewport = useCallback(
    () =>
      (containerRef.current?.querySelector(
        '[data-slot="scroll-area-viewport"]',
      ) as HTMLElement | null) ?? null,
    [],
  )

  const scrollToEnd = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const viewport = findViewport()
      viewport?.scrollTo({ top: viewport.scrollHeight, behavior })
      setHasUnseenBelow(false)
    },
    [findViewport],
  )

  const jumpToLatest = useCallback(() => scrollToEnd("smooth"), [scrollToEnd])

  // Captured when "Load earlier" is pressed, consumed after the prepend
  // renders so the viewport stays anchored on what the user was reading.
  const prependAnchorRef = useRef<{
    firstId: string
    scrollTop: number
    scrollHeight: number
  } | null>(null)
  const lastMessageIdRef = useRef<string | undefined>(undefined)

  const handleLoadEarlier = useCallback(() => {
    const viewport = containerRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLElement | null
    const firstId = messages[0]?.id
    if (viewport && firstId !== undefined) {
      prependAnchorRef.current = {
        firstId,
        scrollTop: viewport.scrollTop,
        scrollHeight: viewport.scrollHeight,
      }
    }
    onLoadEarlier?.()
  }, [messages, onLoadEarlier])

  // Scrolling near the top quietly pulls the previous page, so paging back
  // works without aiming for the button; the button remains for discovery.
  // The guard only re-arms after the first rendered id changes (a real
  // prepend) or the buffer is exceeded, which stops a single near-top
  // position from issuing a burst of duplicate fetches.
  const autoLoadedAtRef = useRef<{ firstId: string; fetches: number } | null>(null)

  useEffect(() => {
    if (!hasEarlierMessages || !onLoadEarlier || isEarlierLoading) return
    if (messages.length === 0) return

    const container = containerRef.current
    if (!container) return

    const viewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLElement | null
    if (!viewport) return

    const THRESHOLD_PX = 96
    const MAX_AUTO_FETCHES = 3

    const onScroll = () => {
      if (isEarlierLoading) return
      if (viewport.scrollTop > THRESHOLD_PX) return

      const firstId = messages[0]?.id
      if (firstId === undefined) return

      if (autoLoadedAtRef.current?.firstId === firstId) {
        if (autoLoadedAtRef.current.fetches >= MAX_AUTO_FETCHES) return
        autoLoadedAtRef.current.fetches += 1
      } else {
        autoLoadedAtRef.current = { firstId, fetches: 1 }
      }

      handleLoadEarlier()
    }

    viewport.addEventListener("scroll", onScroll, { passive: true })
    return () => viewport.removeEventListener("scroll", onScroll)
  }, [hasEarlierMessages, isEarlierLoading, messages, handleLoadEarlier, onLoadEarlier])

  useEffect(() => {
    const newMessages = messages.filter((msg) => !animatedMessages.has(msg.id))

    if (newMessages.length > 0) {
      const timeout = setTimeout(() => {
        setAnimatedMessages((prev) => {
          const updated = new Set(prev)
          newMessages.forEach((msg) => updated.add(msg.id))
          return updated
        })
      }, 350)

      return () => clearTimeout(timeout)
    }
  }, [messages, animatedMessages])

  // Scroll choreography: a PREPEND keeps the reading anchor, an APPEND (new
  // messages from realtime or optimistic send) sinks the viewport to the
  // newest content — but only when the reader is near the bottom; a reader
  // scrolled back into history gets a "jump to latest" pill instead of
  // being yanked, and the first mount just lands at the bottom.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const viewport = findViewport()
    if (!viewport) return

    requestAnimationFrame(() => {
      const anchor = prependAnchorRef.current
      const oldestRenderedId = messages[0]?.id

      if (anchor && oldestRenderedId !== anchor.firstId) {
        prependAnchorRef.current = null
        viewport.scrollTop =
          viewport.scrollHeight - anchor.scrollHeight + anchor.scrollTop
        return
      }

      const lastMessageId = messages.at(-1)?.id
      if (lastMessageId !== undefined && lastMessageId !== lastMessageIdRef.current) {
        const isInitialRender = lastMessageIdRef.current === undefined
        const distanceFromBottom =
          viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight

        if (isInitialRender || distanceFromBottom <= NEAR_BOTTOM_PX) {
          scrollToEnd(isInitialRender ? "auto" : "smooth")
        } else {
          setHasUnseenBelow(true)
        }
      }

      lastMessageIdRef.current = lastMessageId
    })
  }, [messages, findViewport, scrollToEnd])

  // Any scroll back near the bottom dismisses the unseen pill.
  useEffect(() => {
    if (!hasUnseenBelow) return

    const viewport = findViewport()
    if (!viewport) return

    const onScroll = () => {
      if (
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <=
        NEAR_BOTTOM_PX
      ) {
        setHasUnseenBelow(false)
      }
    }
    viewport.addEventListener("scroll", onScroll, { passive: true })
    return () => viewport.removeEventListener("scroll", onScroll)
  }, [hasUnseenBelow, findViewport])

  // Landed state for messages that are no longer rendered (paged out after
  // long sessions) is dropped so the ref/callback maps stay proportional to
  // visible history rather than growing unbounded. Stateful pruning for the
  // animation set happens during render below (a plain ref cleanup there
  // would need a setState, which the hooks compiler rejects in effect
  // bodies).
  useEffect(() => {
    const knownIds = new Set(messages.map((message) => message.id))

    for (const id of Array.from(messageRefs.current.keys())) {
      if (!knownIds.has(id)) {
        messageRefs.current.delete(id)
        refCallbacksRef.current.delete(id)
      }
    }
  }, [messages])

  // Animation membership is derived-from-render data; once the rendered
  // set is far smaller than the tracked set (huge bounded lists), shrink it.
  if (animatedMessages.size > messages.length + 250) {
    const knownIds = new Set(messages.map((message) => message.id))
    const pruned = new Set(
      Array.from(animatedMessages).filter((id) => knownIds.has(id)),
    )
    if (pruned.size < animatedMessages.size) {
      setAnimatedMessages(pruned)
    }
  }

  // One callback per id, recreated only for genuinely new ids.
  const getMessageRef = useCallback((id: string) => {
    let callback = refCallbacksRef.current.get(id)
    if (!callback) {
      callback = (el: HTMLDivElement | null) => {
        if (el) messageRefs.current.set(id, el)
        else messageRefs.current.delete(id)
      }
      refCallbacksRef.current.set(id, callback)
    }
    return callback
  }, [])

  // Read receipts: ONE observer lives for the lifetime of a handler
  // generation (onMessageRead/otherUsername identity), because tearing it
  // down and re-observing every row on each incoming message devolves into
  // O(n) work per new message. A dedicated pass observes only refs that
  // mounted since the last run, which happens exactly when messages change.
  const observerRef = useRef<IntersectionObserver | null>(null)
  const observedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!onMessageRead || !otherUsername) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute("data-message-id")
            if (messageId && !readMessagesRef.current.has(messageId)) {
              readMessagesRef.current.add(messageId)
              onMessageRead(messageId)
            }
          }
        })
      },
      { threshold: 0.5 },
    )

    // A new generation starts from a clean observation ledger: the
    // previous observer was disconnected, so every current row needs
    // re-observing (one O(n) pass on a rare identity change).
    observedIdsRef.current.clear()
    observerRef.current = observer

    for (const [id, el] of messageRefs.current) {
      if (!el) continue
      observer.observe(el)
      observedIdsRef.current.add(id)
    }

    return () => {
      observer.disconnect()
      if (observerRef.current === observer) {
        observerRef.current = null
      }
    }
  }, [onMessageRead, otherUsername])

  // Message changes mount rows; observe the newcomers only.
  useEffect(() => {
    const observer = observerRef.current
    if (!observer) return

    for (const [id, el] of messageRefs.current) {
      if (!el || observedIdsRef.current.has(id)) continue
      observer.observe(el)
      observedIdsRef.current.add(id)
    }
  }, [messages])

  return (
    <div ref={containerRef} className="relative flex min-h-0 flex-1 flex-col">
      {hasUnseenBelow && (
        <button
          type="button"
          onClick={jumpToLatest}
          aria-label="Jump to newest messages"
          className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-brand/40 bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand shadow-sm transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowDown className="size-3" strokeWidth={2} aria-hidden="true" />
          New messages
        </button>
      )}
      <ScrollArea className="flex-1" scrollFade hideScrollbar>
        <div
          role="log"
          aria-label="Conversation"
          aria-relevant="additions text"
          className="space-y-5 px-3 py-5 sm:px-6 sm:py-6"
        >
          {hasEarlierMessages && (
            <div className="flex items-center gap-3 pb-2">
              <span className="h-px flex-1 bg-line" aria-hidden="true" />
              <button
                type="button"
                onClick={handleLoadEarlier}
                disabled={isEarlierLoading}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronUp className="size-3" strokeWidth={2} aria-hidden="true" />
                {isEarlierLoading ? "Loading" : "Load earlier"}
              </button>
              <span className="h-px flex-1 bg-line" aria-hidden="true" />
            </div>
          )}
          {messages.length === 0 && (
            <div className="flex min-h-[320px] items-center justify-center sm:min-h-[420px]">
              <Empty className="border border-dashed border-line bg-card">
                <EmptyMedia variant="icon">
                  {emptyNotice ? (
                    <SearchX className="size-4 text-brand" strokeWidth={1.8} />
                  ) : (
                    <MessageCircle className="size-4 text-brand" strokeWidth={1.8} />
                  )}
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle className="text-lg font-semibold tracking-tight text-foreground">
                    {emptyNotice ? "No matching messages" : "The room is quiet"}
                  </EmptyTitle>
                  <EmptyDescription className="text-sm leading-relaxed text-muted-foreground">
                    {emptyNotice
                      ? "Try a different word or clear the search to see the whole conversation."
                      : "Say something. When the timer ends, this room and everything in it disappear."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          )}

          {messages.map((msg, index) => {
            const isNewMessage = !animatedMessages.has(msg.id)
            // Day separators give the canvas a reading rhythm; they are
            // skipped while filtering so scan results stay compact.
            const showDay = !emptyNotice && messages.length > 1
            const previous = index > 0 ? messages[index - 1] : undefined
            const startsDay =
              showDay &&
              (!previous ||
                new Date(previous.timestamp).toDateString() !==
                  new Date(msg.timestamp).toDateString())
            const dayLabel = startsDay
              ? formatSeparationDate(msg.timestamp)
              : ""

            return (
              <div
                key={msg.id}
                ref={getMessageRef(msg.id)}
                data-message-id={msg.id}
                className={isNewMessage ? "message-enter" : ""}
              >
                {startsDay && (
                  <div
                    role="separator"
                    aria-label={dayLabel}
                    className="mb-5 mt-1 flex items-center gap-3"
                  >
                    <span className="h-px flex-1 bg-line" aria-hidden="true" />
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {dayLabel}
                    </span>
                    <span className="h-px flex-1 bg-line" aria-hidden="true" />
                  </div>
                )}
                <MessageItem
                  message={msg}
                  currentUsername={currentUsername}
                  otherUsername={otherUsername}
                  onReaction={onReaction}
                  onDelete={onDelete}
                  onEdit={onEdit}
                />
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
})
