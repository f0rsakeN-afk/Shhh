"use client"

import { getAvatarEmoji, getInitials, getUserColor } from "@/lib/user-colors"
import { cn } from "@/lib/utils"

interface UserAvatarProps {
  username: string
  /** Chosen avatar index (0-9). Renders its emoji when known. */
  avatar?: number
  size?: "sm" | "md" | "lg"
  className?: string
  isCurrentUser?: boolean
}

const sizeClasses = {
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
}

const emojiSizeClasses = {
  sm: "text-[9px]",
  md: "text-[11px]",
  lg: "text-[13px]",
}

/**
 * Lightweight, deterministic monogram/emoji avatar. No image requests, no
 * layout shift, and it stays on-brand with the room instead of borrowing
 * stock faces. Falls back to initials when no avatar was chosen or the
 * name is unavailable.
 */
export function UserAvatar({
  username,
  avatar,
  size = "md",
  className,
  isCurrentUser = false,
}: UserAvatarProps) {
  const emoji = getAvatarEmoji(avatar)

  return (
    <span
      aria-hidden="true"
      title={username}
      className={cn(
        "grid shrink-0 select-none place-items-center rounded-full border font-semibold leading-none tracking-tight",
        isCurrentUser
          ? "border-brand/25 bg-brand-soft text-brand"
          : getUserColor(username),
        sizeClasses[size],
        emoji && emojiSizeClasses[size],
        className,
      )}
    >
      {emoji ?? getInitials(username)}
    </span>
  )
}
