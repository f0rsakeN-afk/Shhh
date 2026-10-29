"use client"

import { SmilePlus } from "lucide-react"
import { useCallback, useMemo } from "react"
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover"
import { Reaction } from "@/lib/schemas"
import { cn } from "@/lib/utils"

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"]

function toggleReaction(
  emoji: string,
  reactions: Reaction[],
  currentUsername: string,
  onReaction: (emoji: string, action: "add" | "remove") => void,
) {
  const userReaction = reactions.find(
    (reaction) => reaction.emoji === emoji && reaction.username === currentUsername,
  )
  onReaction(emoji, userReaction ? "remove" : "add")
}

export function MessageReactions({
  reactions,
  currentUsername,
  onReaction,
  isOwnMessage = false,
}: MessageReactionsProps) {
  const groupedReactions = useMemo(
    () =>
      reactions.reduce(
        (acc, reaction) => {
          const key = reaction.emoji
          if (!acc[key]) {
            acc[key] = []
          }
          acc[key].push(reaction)
          return acc as Record<string, Reaction[]>
        },
        {} as Record<string, Reaction[]>,
      ),
    [reactions],
  )

  const handleEmojiClick = useCallback(
    (emoji: string) => {
      toggleReaction(emoji, reactions, currentUsername, onReaction)
    },
    [reactions, currentUsername, onReaction],
  )

  const emojiButtons = COMMON_EMOJIS.map((emoji) => {
    const total = groupedReactions[emoji]?.length ?? 0
    const hasUserReaction = groupedReactions[emoji]?.some(
      (r) => r.username === currentUsername,
    ) ?? false

    return (
      <button
        key={emoji}
        type="button"
        onClick={() => handleEmojiClick(emoji)}
        data-emoji={emoji}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10.5px] transition-colors",
          hasUserReaction
            ? "border-brand/40 bg-brand-soft text-brand"
            : "border-line bg-card text-muted-foreground hover:border-foreground/20 hover:bg-accent",
        )}
        aria-pressed={hasUserReaction}
        aria-label={`${emoji} ${total} reaction${total === 1 ? "" : "s"}`}
      >
        <span>{emoji}</span>
        <span className="tabular-nums text-[9.5px] opacity-70">
          {total}
        </span>
      </button>
    )
  })

  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {Object.entries(groupedReactions).map(([emoji, emojiReactions]) => {
          const total = emojiReactions.length
          const hasUserReaction = emojiReactions.some(
            (r) => r.username === currentUsername,
          )

          return (
            <button
              key={emoji}
              type="button"
              onClick={() => handleEmojiClick(emoji)}
              data-emoji={emoji}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10.5px] transition-colors",
                hasUserReaction
                  ? "border-brand/40 bg-brand-soft text-brand"
                  : "border-line bg-card text-muted-foreground hover:border-foreground/20 hover:bg-accent",
              )}
              aria-label={`${emoji} ${total} reaction${total === 1 ? "" : "s"}`}
            >
              <span>{emoji}</span>
              <span className="tabular-nums text-[9.5px] opacity-70">
                {total}
              </span>
            </button>
          )
        })}

        {/* Add reaction button */}
        <Popover>
          <PopoverTrigger
            as-child
            aria-label="Add a reaction"
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-base outline-none transition-colors duration-150 pointer-coarse:h-12 pointer-coarse:w-12 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <SmilePlus className="size-3.5" strokeWidth={1.8} />
          </PopoverTrigger>

          <PopoverPopup
            side="bottom"
            align={isOwnMessage ? "end" : "start"}
            sideOffset={6}
            alignOffset={0}
            className={cn(
              "rounded-lg border border-line bg-popover p-1 shadow-md",
              isOwnMessage ? "right-0" : "left-0",
            )}
          >
            <div className="flex items-center gap-0.5">
              {emojiButtons}
            </div>
          </PopoverPopup>
        </Popover>
      </div>
    </>
  )
}

interface MessageReactionsProps {
  reactions: Reaction[]
  currentUsername: string
  onReaction: (emoji: string, action: "add" | "remove") => void
  isOwnMessage?: boolean
}