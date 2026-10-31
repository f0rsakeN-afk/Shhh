"use client"

import { SmilePlus } from "lucide-react"
import { useCallback, useMemo } from "react"
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover"
import { EmojiPalette } from "@/components/emoji-picker"
import { Reaction } from "@/lib/schemas"
import { cn } from "@/lib/utils"

interface MessageReactionsProps {
  reactions: Reaction[]
  currentUsername: string
  onReaction: (emoji: string, action: "add" | "remove") => void
  isOwnMessage?: boolean
}

/**
 * Reaction row for a message. The server enforces one reaction per user per
 * message, so the client mirrors that: clicking a chip that is already yours
 * removes it, clicking any other chip (or picking from the palette) sends an
 * "add" that atomically replaces whatever you had. Chips stay grouped by
 * emoji with per-emoji counts.
 */
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

  // Radio-like toggle: same emoji that is mine -> remove; anything else ->
  // add, which the server turns into a replace. One user, one emoji, always.
  const handleEmojiClick = useCallback(
    (emoji: string) => {
      const mine = reactions.find((r) => r.username === currentUsername)
      if (mine && mine.emoji === emoji) {
        onReaction(emoji, "remove")
      } else {
        onReaction(emoji, "add")
      }
    },
    [reactions, currentUsername, onReaction],
  )

  const chipClasses = (hasUserReaction: boolean) =>
    cn(
      "inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10.5px] transition-colors",
      hasUserReaction
        ? "border-brand/40 bg-brand-soft text-brand"
        : "border-line bg-card text-muted-foreground hover:border-foreground/20 hover:bg-accent",
    )

  return (
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
            className={chipClasses(hasUserReaction)}
            aria-pressed={hasUserReaction}
            aria-label={`${emoji}, ${total} reaction${total === 1 ? "" : "s"}${hasUserReaction ? ", click to remove" : ""}`}
          >
            <span>{emoji}</span>
            <span className="tabular-nums text-[9.5px] opacity-70">
              {total}
            </span>
          </button>
        )
      })}

      {/* Add reaction button: revealed with the message row on hover,
          always present on touch where hover does not exist. */}
      <Popover>
        <PopoverTrigger
          aria-label="Add a reaction"
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-md border border-line text-muted-foreground outline-none transition-[background-color,color,opacity] duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100",
          )}
        >
          <SmilePlus className="size-3.5" strokeWidth={1.8} />
        </PopoverTrigger>

        <PopoverPopup
          side="bottom"
          align={isOwnMessage ? "end" : "start"}
          sideOffset={6}
          className="overflow-hidden p-0 [&_button]:select-none"
        >
          <EmojiPalette onPick={handleEmojiClick} size="sm" />
        </PopoverPopup>
      </Popover>
    </div>
  )
}
