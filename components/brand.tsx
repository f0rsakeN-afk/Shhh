import Link from "next/link"
import { cn } from "@/lib/utils"

interface BrandProps {
  href?: string
  compact?: boolean
  className?: string
  wordmarkClassName?: string
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10.2L5.6 19.6A.9.9 0 0 1 4.2 18.9V6.5Z" />
      <path d="M8.4 10h.01M12 10h.01M15.6 10h.01" strokeWidth="2.6" />
    </svg>
  )
}

export function Brand({
  href = "/",
  compact = false,
  className,
  wordmarkClassName,
}: BrandProps) {
  return (
    <Link
      href={href}
      aria-label="Shhh home"
      className={cn(
        "group flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <span className="relative grid size-8 place-items-center rounded-lg border border-line bg-card text-brand transition-colors duration-150 group-hover:border-brand/40 group-hover:bg-brand-soft">
        <BrandMark className="size-[17px]" />
      </span>
      {!compact && (
        <span
          className={cn(
            "text-base font-semibold leading-none tracking-[-0.02em] text-foreground",
            wordmarkClassName,
          )}
        >
          Shhh
        </span>
      )}
    </Link>
  )
}
