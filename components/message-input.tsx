"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface MessageInputProps {
  onSend: (text: string) => void
  onTyping?: (isTyping: boolean) => void
  isPending?: boolean
  placeholder?: string
}

export function MessageInput({
  onSend,
  onTyping,
  isPending = false,
  placeholder = "Type a message…",
}: MessageInputProps) {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      if (!onTyping) return

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      onTyping(isTyping)

      if (isTyping) {
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

  useEffect(() => {
    const element = inputRef.current
    if (!element) return
    element.style.height = "auto"
    element.style.height = `${Math.min(element.scrollHeight, 140)}px`
  }, [input])

  const handleSend = useCallback(() => {
    if (!input.trim() || isPending) return

    handleTyping(false)
    onSend(input)
    setInput("")
    inputRef.current?.focus()
  }, [handleTyping, input, isPending, onSend])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing
      ) {
        event.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value
      setInput(value)

      if (value.trim()) {
        handleTyping(true)
      } else {
        handleTyping(false)
      }
    },
    [handleTyping],
  )

  const canSend = Boolean(input.trim()) && !isPending

  return (
    <div className="border-t border-line bg-background/80 px-3 pb-4 pt-3 backdrop-blur-sm sm:px-6 sm:pb-5">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-end gap-2 rounded-lg border border-line bg-card p-1.5 transition-[border-color,box-shadow] duration-150 focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-ring/20">
          <textarea
            ref={inputRef}
            autoFocus
            rows={1}
            maxLength={1000}
            value={input}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            onChange={handleChange}
            className="max-h-36 min-h-9 flex-1 resize-none self-center bg-transparent px-2 py-2 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground"
            aria-label="Message"
            aria-describedby="composer-hint"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              canSend
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground",
            )}
            aria-label="Send message"
          >
            <ArrowUp className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div
          id="composer-hint"
          className="mt-2 flex items-center justify-between px-1 text-xs text-muted-foreground"
        >
          <span className="hidden sm:inline">
            Enter to send · Shift + Enter for a new line
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
