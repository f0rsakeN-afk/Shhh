import { cn } from "@/lib/utils"

interface AmbientBackdropProps {
  className?: string
  variant?: "hero" | "soft" | "room"
}

/**
 * Cheap, CSS-only atmosphere. No particles, no JS, no repaint storm.
 */
export function AmbientBackdrop({
  className,
  variant = "hero",
}: AmbientBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      {/* Warm ember bloom */}
      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 rounded-full bg-brand/10 blur-[120px] animate-glow",
          variant === "hero"
            ? "-top-56 h-[38rem] w-[56rem]"
            : "-top-72 h-[30rem] w-[44rem] opacity-70",
        )}
      />

      {/* Cool counterweight for depth */}
      <div className="absolute -right-40 top-1/3 h-[26rem] w-[26rem] rounded-full bg-info/[0.06] blur-[120px] dark:bg-info/[0.08]" />
      <div className="absolute -left-40 bottom-0 h-[22rem] w-[22rem] rounded-full bg-warning/[0.05] blur-[110px] dark:bg-brand/[0.06]" />

      {/* Hairline grid, faded at the edges */}
      <div className="absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_50%_35%,black_10%,transparent_72%)]" />

      {/* Top light line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />

      {variant === "room" && (
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-brand/[0.04] to-transparent" />
      )}
    </div>
  )
}
