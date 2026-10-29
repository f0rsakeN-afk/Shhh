import { cn } from "@/lib/utils"

interface StripeDividerProps {
  className?: string
}

export function StripeDivider({ className }: StripeDividerProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "stripe-divider mx-auto w-full max-w-5xl border-line md:border-x",
        className,
      )}
    />
  )
}
