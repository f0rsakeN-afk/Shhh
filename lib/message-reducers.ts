import type { Message } from "@/lib/schemas"

/**
 * What GET /messages returns and what the realtime cache must always
 * preserve: `hasMore` survives every optimistic and live update.
 */
export interface MessageHistory {
  messages: Message[]
  hasMore: boolean
}

/**
 * Replay window for double-delivery detection. The realtime stream can
 * redeliver an event across an SSE rotation; two legitimately distinct
 * messages from one sender land more than this apart (or carry different
 * ids), so the window stays narrow on purpose.
 */
const DEDUPE_WINDOW_MS = 2000

/**
 * Apply a live chat.message event to the cached history.
 *
 * Invariants, in order:
 * - no cache yet → the caller's `old` passes through untouched
 * - an own optimistic (temp-*) message with the same text is REPLACED in
 *   place by the server copy, so the bubble keeps its position while
 *   gaining the real id
 * - an event already present (by id, or same text+sender inside the
 *   replay window) is dropped, so stream replays and REST resyncs
 *   converge instead of duplicating rows
 * - everything else appends; `hasMore` is carried through verbatim
 *
 * The returned object is always a NEW history (or `old` unchanged), so
 * React Query cache semantics hold.
 */
export function applyIncomingMessage(
  old: MessageHistory | undefined,
  incoming: Message,
  currentUsername: string,
): MessageHistory | undefined {
  if (!old?.messages) return old

  // The client renders own messages with a static token marker; the real
  // token never needs to exist client-side.
  const normalized: Message = {
    ...incoming,
    token: incoming.sender === currentUsername ? "current" : undefined,
  }

  if (incoming.sender === currentUsername) {
    const existingIndex = old.messages.findIndex(
      (msg) =>
        msg.id.startsWith("temp-") &&
        msg.text === incoming.text &&
        msg.sender === incoming.sender,
    )
    if (existingIndex !== -1) {
      const updatedMessages = [...old.messages]
      updatedMessages[existingIndex] = normalized
      return { messages: updatedMessages, hasMore: old.hasMore }
    }
  }

  const alreadyExists = old.messages.some(
    (msg) =>
      msg.id === incoming.id ||
      (msg.text === incoming.text &&
        msg.sender === incoming.sender &&
        Math.abs(msg.timestamp - incoming.timestamp) < DEDUPE_WINDOW_MS),
  )
  if (alreadyExists) return old

  return {
    messages: [...old.messages, normalized],
    hasMore: old.hasMore,
  }
}

/**
 * Apply a live chat.edited event. Only the targeted message changes; a
 * miss (stale event, already-deleted row) returns the cache unmodified so
 * downstream memos keep their identity.
 */
export function applyEditedMessage(
  old: MessageHistory | undefined,
  messageId: string,
  text: string,
): MessageHistory | undefined {
  if (!old?.messages) return old

  let touched = false
  const messages = old.messages.map((msg) => {
    if (msg.id !== messageId) return msg
    touched = true
    return { ...msg, text, edited: true }
  })

  return touched ? { messages, hasMore: old.hasMore } : old
}

/**
 * Apply a live chat.reaction event. The payload is the server's full
 * merge result, so it is ASSIGNED (never merged) and every client
 * converges under racing clicks. A miss leaves the cache untouched.
 */
export function assignMessageReactions(
  old: MessageHistory | undefined,
  messageId: string,
  reactions: Message["reactions"],
): MessageHistory | undefined {
  if (!old?.messages) return old

  let touched = false
  const messages = old.messages.map((msg) => {
    if (msg.id !== messageId) return msg
    touched = true
    return { ...msg, reactions }
  })

  return touched ? { messages, hasMore: old.hasMore } : old
}
