import { Spinner } from "@/components/ui/spinner"

/**
 * Route-level fallback shown while the room segment's client bundle loads.
 * Without it, a cold navigation to an invite link renders a blank document
 * until hydration; this paints the same treatment the join screen uses, so
 * the transition reads as one flow instead of a gap.
 */
export default function RoomLoading() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background p-6 text-foreground">
      <div className="flex flex-col items-center gap-4">
        <Spinner className="size-5 text-brand" />
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Opening room
        </p>
      </div>
    </main>
  )
}
