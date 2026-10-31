"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { ArrowUp, Pen, Smile, X } from "lucide-react"
import { EmojiPicker } from "@/components/emoji-picker"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MessageInputProps {
  onSend: (text: string) => void
  onTyping?: (isTyping: boolean) => void
  isPending?: boolean
  placeholder?: string
  /** Room participant usernames, used for @mention autocomplete. */
  participants?: string[]
  /** The message currently being edited, or null. */
  editing?: { id: string; text: string } | null
  onCancelEdit?: () => void
  onEditSave?: (text: string) => void
  /** Raised when the input is empty and ArrowUp is pressed, to edit the last own message. */
  onEditLastRequest?: () => void
}

const MENTION_TRIGGER = /@([^\s@]*)$/

export function MessageInput({
  onSend,
  onTyping,
  isPending = false,
  placeholder = "Type a message…",
  participants = [],
  editing = null,
  onCancelEdit,
  onEditSave,
  onEditLastRequest,
}: MessageInputProps) {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const [caret, setCaret] = useState<number | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionDismissed, setMentionDismissed] = useState(false)
  const [loadedEditingId, setLoadedEditingId] = useState<string | null>(null)

  const isEditing = Boolean(editing)

  // Reset the composer when a different message enters edit mode, and clear
  // it when edit mode ends. Adjusting during render keeps this a one-pass
  // transition instead of an effect with cascading renders.
  if (editing?.id && editing.id !== loadedEditingId) {
    setLoadedEditingId(editing.id)
    setInput(editing.text)
    setMentionDismissed(false)
  } else if (!editing && loadedEditingId) {
    setLoadedEditingId(null)
    setInput("")
  }

  // DOM-only synchronization: put the caret at the end when edit mode starts.
  useEffect(() => {
    if (!editing) return
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id])

  const mentionQuery = useMemo(() => {
    if (!isEditing || caret === null || caret > input.length) return null
    const slice = input.slice(0, caret)
    const match = slice.match(MENTION_TRIGGER)
    if (!match) return null
    return match[1]
  }, [input, caret, isEditing])

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return []
    const token = mentionQuery.toLowerCase()
    return participants
      .filter((name) => name && name.toLowerCase().includes(token))
      .slice(0, 5)
  }, [mentionQuery, participants])

  const mentionOpen = mentionMatches.length > 0 && !mentionDismissed

  // Derive the active row from the raw index so list resets ("shrink to
  // zero", new results) never need a clamping effect.
  const activeMentionIndex =
    mentionMatches.length > 0 ? mentionIndex % mentionMatches.length : 0

  const handleTyping = useCallback(
    (isTypingNow: boolean) => {
      if (!onTyping) return

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      onTyping(isTypingNow)

      if (isTypingNow) {
        typingTimeoutRef.current = setTimeout(() => {
          onTyping?.(false)
        }, 3000)
      }
    },
    [onTyping],
  )

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  useLayoutAutosize(inputRef, input)

  const insertMention = useCallback(
    (username: string) => {
      if (mentionQuery === null || caret === null) return

      const start = caret - mentionQuery.length - 1 // include the @
      const before = `${input.slice(0, Math.max(start, 0))}@${username} `
      const after = input.slice(caret)
      const next = before + after
      const nextCaret = before.length

      setInput(next)
      setMentionIndex(0)
      setMentionDismissed(true)
      requestAnimationFrame(() => {
        const el = inputRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(nextCaret, nextCaret)
      })
    },
    [input, caret, mentionQuery],
  )

  const insertEmoji = useCallback(
    (emoji: string) => {
      const el = inputRef.current
      const position = el?.selectionStart ?? input.length
      const before = input.slice(0, position)
      const after = input.slice(position)
      const next = before + emoji + after
      const nextCaret = before.length + emoji.length

      setInput(next)
      setMentionDismissed(true)
      handleTyping(true)
      requestAnimationFrame(() => {
        el?.focus()
        el?.setSelectionRange(nextCaret, nextCaret)
      })
    },
    [input, handleTyping],
  )

  const handleSend = useCallback(() => {
    const value = input.trim()

    if (isEditing) {
      if (value && onEditSave && editing) onEditSave(value)
      return
    }

    if (!value || isPending) return

    handleTyping(false)
    onSend(value)
    setInput("")
    setMentionIndex(0)
    inputRef.current?.focus()
  }, [
    editing,
    handleTyping,
    input,
    isEditing,
    isPending,
    onEditSave,
    onSend,
  ])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionOpen) {
        if (event.key === "ArrowDown") {
          event.preventDefault()
          setMentionIndex((prev) => (prev + 1) % Math.max(mentionMatches.length, 1))
          return
        }
        if (event.key === "ArrowUp") {
          event.preventDefault()
          setMentionIndex(
            (prev) =>
              (prev - 1 + mentionMatches.length) % Math.max(mentionMatches.length, 1),
          )
          return
        }
        if (event.key === "Tab" || event.key === "Enter") {
          // Keep the user focused in the textarea while the suggestion is
          // applied; the panel closes by clearing its query.
          event.preventDefault()
          insertMention(mentionMatches[activeMentionIndex])
          return
        }
        if (event.key === "Escape") {
          event.preventDefault()
          setMentionDismissed(true)
          return
        }
      }

      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing
      ) {
        event.preventDefault()
        handleSend()
        return
      }

      if (event.key === "Escape" && isEditing && !event.nativeEvent.isComposing) {
        event.preventDefault()
        onCancelEdit?.()
        return
      }

      if (
        event.key === "ArrowUp" &&
        !event.shiftKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        input.length === 0 &&
        !isEditing &&
        !event.nativeEvent.isComposing
      ) {
        event.preventDefault()
        onEditLastRequest?.()
      }
    },
    [
      activeMentionIndex,
      handleSend,
      insertMention,
      input.length,
      isEditing,
      mentionMatches,
      mentionOpen,
      onCancelEdit,
      onEditLastRequest,
    ],
  )

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value
      setInput(value)
      setCaret(event.target.selectionStart)
      setMentionIndex(0)
      setMentionDismissed(false)

      if (value.trim()) {
        handleTyping(true)
      } else {
        handleTyping(false)
      }
    },
    [handleTyping],
  )

  const handleSelect = useCallback(
    (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
      setCaret(event.currentTarget.selectionStart)
    },
    [],
  )

  const canSend = Boolean(input.trim()) && !isPending && !isEditing
  const canSaveEdit = Boolean(input.trim()) && isEditing
  const activeMentionId =
    mentionOpen && mentionMatches.length > 0
      ? `composer-mention-${activeMentionIndex}`
      : undefined

  return (
    <div className="border-t border-line bg-background/80 px-3 pb-4 pt-3 backdrop-blur-sm sm:px-6 sm:pb-5">
      <div className="mx-auto w-full max-w-5xl">
        {isEditing && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-brand/30 bg-brand-soft px-3 py-2">
            <span className="inline-flex min-w-0 items-center gap-2 text-xs font-medium text-brand">
              <Pen className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              Editing your message
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancelEdit}
              disabled={isPending}
            >
              <X aria-hidden="true" />
              Cancel
            </Button>
          </div>
        )}

        <div className="relative rounded-lg border border-line bg-card p-1.5 transition-[border-color,box-shadow] duration-150 focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-ring/20">
          {/* Mention autocomplete panel: keeps focus in the textarea with
              aria-activedescendant, the pattern IME-safe composers use. */}
          {mentionOpen && (
            <div
              id="composer-mentions"
              role="listbox"
              aria-label="Mention someone"
              aria-labelledby="composer-input"
              className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-lg border border-line bg-popover p-1 shadow-md"
            >
              {mentionMatches.map((name, index) => (
                <button
                  key={name}
                  type="button"
                  role="option"
                  id={`composer-mention-${index}`}
                  aria-selected={index === activeMentionIndex}
                  onMouseEnter={() => setMentionIndex(index)}
                  // Keep the caret (and IME focus) in the textarea.
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => insertMention(name)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                    index === activeMentionIndex
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand"
                  >
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <EmojiPicker
                onPick={insertEmoji}
                align="start"
                label="Add emoji to your message"
                triggerClassName="grid size-9 shrink-0 place-items-center rounded-md border border-transparent text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-popup-open:bg-accent data-popup-open:text-foreground"
              >
                <Smile size={16} strokeWidth={1.8} aria-hidden="true" />
              </EmojiPicker>

              <textarea
                ref={inputRef}
                autoFocus={!isEditing}
                rows={1}
                maxLength={1000}
                value={input}
                onKeyDown={handleKeyDown}
                placeholder={isEditing ? "Edit your message…" : placeholder}
                onChange={handleChange}
                onSelect={handleSelect}
                onFocus={(event) =>
                  setCaret(event.currentTarget.selectionStart)
                }
                onBlur={() => setMentionDismissed(true)}
                className="max-h-36 min-h-9 flex-1 resize-none self-center bg-transparent px-2 py-2 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground"
                aria-label={isEditing ? "Edit message" : "Message"}
                aria-describedby="composer-hint"
                aria-autocomplete={mentionOpen ? "list" : undefined}
                aria-controls={mentionOpen ? "composer-mentions" : undefined}
                aria-activedescendant={activeMentionId}
                id="composer-input"
                autoComplete="off"
              />

              {isEditing ? (
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    onClick={onCancelEdit}
                    aria-label="Cancel edit"
                  >
                    <X aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-lg"
                    onClick={handleSend}
                    disabled={!canSaveEdit}
                    aria-label="Save edit"
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="icon-lg"
                  onClick={handleSend}
                  disabled={!canSend}
                  aria-label="Send message"
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <div
          id="composer-hint"
          className="mt-2 flex items-center justify-between px-1 text-xs text-muted-foreground"
        >
          <span className="hidden sm:inline">
            Enter to send · Shift + Enter for a new line · ↑ to edit your last
            message · @ to mention
          </span>
          <span className="sm:hidden">Say it, then let it go</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1 rounded-full bg-brand" aria-hidden="true" />
            Disappears with the room
          </span>
        </div>
      </div>
    </div>
  )
}

/** Auto-size the composer up to a hard cap; a plain DOM sync, no state. */
function useLayoutAutosize(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [ref, value])
}
