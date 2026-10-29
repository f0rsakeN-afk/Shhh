import { cn } from "@/lib/utils"

function HandwrittenNote({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="handwritten-note"
      aria-hidden="true"
      className={cn(
        "pointer-events-none inline-block select-none font-handwritten text-xl leading-none tracking-normal text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

/** Hand-drawn squiggle arrow. Points right; mirror or rotate to aim it. */
function HandwrittenArrow({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      className={cn("size-6 shrink-0 text-muted-foreground", className)}
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 22c12 3 22-1 30-14" />
      <path d="m28 6 7 1-2 8" />
    </svg>
  )
}

interface SectionHeadingProps {
  subHeading: string
  heading: string
  headingId?: string
  className?: string
}

function SectionHeading({
  subHeading,
  heading,
  headingId,
  className,
}: SectionHeadingProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <span className="h-px w-5 bg-brand/60" aria-hidden="true" />
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {subHeading}
        </p>
      </div>
      <h2
        id={headingId}
        className="mt-2 text-balance text-2xl font-semibold tracking-[-0.025em] sm:text-3xl"
      >
        {heading}
      </h2>
    </div>
  )
}

export { HandwrittenNote, HandwrittenArrow, SectionHeading }
