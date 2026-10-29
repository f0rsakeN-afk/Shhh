"use client"

import { SmilePlus } from "lucide-react"
import { useCallback, useState } from "react"
import { Reaction } from "@/lib/schemas"
import { cn } from "@/lib/utils"

interface MessageReactionsProps {
  reactions: Reaction[]
  currentUsername: string
  onReaction: (emoji: string, action: "add" | "remove") => void
  isOwnMessage?: boolean
}

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"]

export function MessageReactions({
  reactions,
  currentUsername,
  onReaction,
  isOwnMessage = false,
}: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false)

  const groupedReactions = reactions.reduce(
    (acc, reaction) => {
      const key = reaction.emoji
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(reaction)
      return acc
    },
    {} as Record<string, Reaction[]>,
  )

  const handleReactionEvent = (event: React.MouseEvent<HTMLButtonElement>) => {
    const emoji = event.currentTarget.dataset.emoji
    if (!emoji) return

    const userReaction = reactions.find(
      (reaction) =>
        reaction.emoji === emoji && reaction.username === currentUsername,
    )

    onReaction(emoji, userReaction ? "remove" : "add")
    setShowPicker(false)
  }

  const togglePicker = useCallback(() => {
    setShowPicker((value) => !value)
  }, [])

  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {Object.entries(groupedReactions).map(([emoji, emojiReactions]) => {
          const hasUserReaction = emojiReactions.some(
            (r) => r.username === currentUsername,
          )

          return (
            <button
              key={emoji}
              type="button"
              onClick={handleReactionEvent}
              data-emoji={emoji}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10.5px] transition-colors",
                hasUserReaction
                  ? "border-brand/40 bg-brand-soft text-brand"
                  : "border-line bg-card text-muted-foreground hover:border-foreground/20 hover:bg-accent",
              )}
              aria-label={`${emoji} ${emojiReactions.length} reaction${emojiReactions.length === 1 ? "" : "s"}`}
            >
              <span>{emoji}</span>
              <span className="tabular-nums text-[9.5px] opacity-70">
                {emojiReactions.length}
              </span>
            </button>
          )
        })}

        <button
          type="button"
          onClick={togglePicker}
          aria-label="Add a reaction"
          aria-expanded={showPicker}
          className="grid size-6 place-items-center rounded-md text-muted-foreground/60 opacity-0 transition-colors hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
        >
          <SmilePlus className="size-3.5" strokeWidth={1.8} />
        </button>
      </div>

      {showPicker && (
        <div
          className={cn(
            "absolute bottom-full z-30 mb-2 flex max-w-[calc(100vw-2rem)] items-center gap-0.5 rounded-lg border border-line bg-popover p-1 shadow-md",
            isOwnMessage ? "right-0" : "left-0",
          )}
        >
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={handleReactionEvent}
              data-emoji={emoji}
              className="grid size-8 place-items-center rounded-md text-base transition-transform hover:scale-110 hover:bg-accent"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
