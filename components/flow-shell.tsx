import Link from "next/link"
import { ArrowLeft, Check } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { cn } from "@/lib/utils"

interface FlowShellProps {
  children: React.ReactNode
  asideTitle: React.ReactNode
  asideDescription: string
  points?: string[]
  backHref?: string
  backLabel?: string
  className?: string
}

export function FlowShell({
  children,
  asideTitle,
  asideDescription,
  points = [],
  backHref = "/",
  backLabel = "Back",
  className,
}: FlowShellProps) {
  return (
    <>
      <SiteHeader variant="app" />

      <main
        id="main-content"
        className="min-h-[calc(100dvh-3.5rem)] overflow-x-clip bg-background text-foreground"
      >
        <div
          className={cn(
            "screen-line-top screen-line-bottom relative z-10 mx-auto grid min-h-[calc(100dvh-3.5rem)] w-full max-w-5xl items-start gap-10 border-line px-4 py-10 md:border-x md:px-8 md:py-14 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-16",
            className,
          )}
        >
          <div className="order-1 w-full animate-rise lg:order-2">
            {children}
          </div>

          <aside className="order-2 lg:order-1 lg:sticky lg:top-24">
            <p className="text-xs font-medium text-muted-foreground">
              Private rooms
            </p>

            <h2 className="mt-3 text-balance text-3xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl">
              {asideTitle}
            </h2>

            <p className="mt-4 max-w-md text-pretty text-[15px] leading-relaxed text-muted-foreground">
              {asideDescription}
            </p>

            {points.length > 0 && (
              <ul className="mt-8 max-w-md border-t border-line">
                {points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-3 border-b border-line py-3 text-sm leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                      <Check className="size-2.5" strokeWidth={2.4} aria-hidden="true" />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            )}

            <Link
              href={backHref}
              className="mt-8 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              {backLabel}
            </Link>
          </aside>
        </div>
      </main>
    </>
  )
}
