"use client"

import { getInitials, getUserColor } from "@/lib/user-colors"
import { cn } from "@/lib/utils"

interface UserAvatarProps {
  username: string
  size?: "sm" | "md" | "lg"
  className?: string
  isCurrentUser?: boolean
}

const sizeClasses = {
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
}

/**
 * Lightweight, deterministic monogram avatar. No image requests, no layout
 * shift, and it stays on-brand with the room instead of borrowing stock faces.
 */
export function UserAvatar({
  username,
  size = "md",
  className,
  isCurrentUser = false,
}: UserAvatarProps) {
  return (
    <span
      aria-hidden="true"
      title={username}
      className={cn(
        "grid shrink-0 place-items-center rounded-full border font-semibold uppercase leading-none tracking-tight",
        isCurrentUser
          ? "border-brand/25 bg-brand-soft text-brand"
          : getUserColor(username),
        sizeClasses[size],
        className,
      )}
    >
      {getInitials(username)}
    </span>
  )
}
