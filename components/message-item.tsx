"use client"

import { memo, useCallback } from "react"
import { Trash2 } from "lucide-react"
import { format } from "date-fns"
import { Message } from "@/lib/schemas"
import { MessageReactions } from "./message-reactions"
import { ReadReceiptIndicator } from "./read-receipt"
import { MessageActions } from "./message-actions"
import { UserAvatar } from "./user-avatar"
import { cn } from "@/lib/utils"

interface MessageItemProps {
  message: Message
  currentUsername: string
  otherUsername?: string
  onReaction?: (messageId: string, emoji: string, action: "add" | "remove") => void
  onDelete?: (messageId: string) => void
}

export const MessageItem = memo(function MessageItem({
  message,
  currentUsername,
  otherUsername,
  onReaction,
  onDelete,
}: MessageItemProps) {
  const isOwnMessage = message.sender === currentUsername

  const handleReaction = useCallback(
    (emoji: string, action: "add" | "remove") => {
      onReaction?.(message.id, emoji, action)
    },
    [message.id, onReaction],
  )

  const handleDelete = useCallback(() => {
    onDelete?.(message.id)
  }, [message.id, onDelete])

  if (message.deleted) {
    return (
      <div
        className={cn(
          "flex w-full",
          isOwnMessage ? "justify-end" : "justify-start",
        )}
      >
        <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 py-1 text-xs italic text-muted-foreground">
          <Trash2 className="size-3" strokeWidth={1.8} aria-hidden="true" />
          Message deleted
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "group flex w-full gap-2.5",
        isOwnMessage ? "flex-row-reverse" : "flex-row",
      )}
    >
      <UserAvatar
        username={message.sender}
        size="sm"
        className="mt-0.5"
        isCurrentUser={isOwnMessage}
      />

      <div
        className={cn(
          "flex min-w-0 max-w-[85%] flex-col sm:max-w-[72%]",
          isOwnMessage ? "items-end" : "items-start",
        )}
      >
        {!isOwnMessage && (
          <div className="mb-1 flex items-center gap-2 pl-0.5">
            <span className="truncate text-xs font-medium text-foreground">
              {message.sender}
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {format(message.timestamp, "HH:mm")}
            </span>
          </div>
        )}

        <div className="relative max-w-full">
          <div
            className={cn(
              "max-w-full whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm leading-relaxed",
              isOwnMessage
                ? "rounded-tr-sm bg-primary text-primary-foreground"
                : "rounded-tl-sm border border-line bg-muted text-foreground",
            )}
          >
            {message.text}
          </div>

          {onReaction && (
            <MessageReactions
              reactions={message.reactions || []}
              currentUsername={currentUsername}
              onReaction={handleReaction}
              isOwnMessage={isOwnMessage}
            />
          )}
        </div>

        <div
          className={cn(
            "mt-1 flex min-h-4 items-center gap-2",
            isOwnMessage ? "flex-row-reverse" : "flex-row",
          )}
        >
          {isOwnMessage && (
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {format(message.timestamp, "HH:mm")}
            </span>
          )}

          {isOwnMessage && message.readBy && (
            <ReadReceiptIndicator
              readBy={message.readBy}
              currentUsername={currentUsername}
              otherUsername={otherUsername}
            />
          )}

          {isOwnMessage && onDelete && (
            <MessageActions onDelete={handleDelete} />
          )}
        </div>
      </div>
    </div>
  )
})
