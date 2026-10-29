"use client"

interface TypingIndicatorProps {
  usernames: string[]
}

export function TypingIndicator({ usernames }: TypingIndicatorProps) {
  if (usernames.length === 0) return null

  const label =
    usernames.length === 1
      ? `${usernames[0]} is typing`
      : usernames.length === 2
        ? `${usernames[0]} and ${usernames[1]} are typing`
        : `${usernames.length} people are typing`

  return (
    <div className="flex h-8 shrink-0 items-center px-3 sm:px-6" aria-live="polite">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 pl-1 text-xs text-muted-foreground">
        <span className="flex items-end gap-[3px]" aria-hidden="true">
          <span className="size-1 animate-typing rounded-full bg-brand" />
          <span className="size-1 animate-typing rounded-full bg-brand [animation-delay:150ms]" />
          <span className="size-1 animate-typing rounded-full bg-brand [animation-delay:300ms]" />
        </span>
        <span className="truncate">{label}</span>
      </div>
    </div>
  )
}
