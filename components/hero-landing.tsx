import Link from "next/link"
import {
  ArrowRight,
  CheckCheck,
  Clock3,
  Ghost,
  KeyRound,
  MessageCircle,
  ShieldCheck,
  TimerReset,
} from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { StripeDivider } from "@/components/stripe-divider"
import { AmbientBackdrop } from "@/components/ambient-backdrop"

const features = [
  {
    icon: MessageCircle,
    title: "Create a room",
    body: "One click opens a private room and starts the clock. There is nothing to install and nothing to configure.",
  },
  {
    icon: KeyRound,
    title: "Send one link",
    body: "The link is the only invite. Up to ten people can be in the room, and everyone arrives with a generated name.",
  },
  {
    icon: TimerReset,
    title: "Let it close",
    body: "After one hour the room and every message inside it are deleted. Nothing is archived or recoverable.",
  },
]

const primaryLink =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-5 text-sm font-medium text-primary-foreground shadow-xs transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

const secondaryLink =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-background/60 px-5 text-sm font-medium text-foreground shadow-xs transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

export function HeroLanding() {
  return (
    <>
      <SiteHeader />

      <main
        id="main-content"
        className="flex min-h-[calc(100dvh-3.5rem)] flex-col overflow-x-clip"
      >
        <section className="screen-line-top relative z-10 mx-auto w-full max-w-5xl overflow-hidden border-line px-4 pb-12 pt-10 md:border-x md:px-8 md:pb-16 md:pt-16">
          <AmbientBackdrop
            variant="hero"
            className="hidden opacity-80 md:block"
          />

          <div className="relative grid items-center gap-12 lg:grid-cols-[1.04fr_0.96fr] lg:gap-12">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
                Private rooms with a one-hour limit
              </p>

              <h1 className="mt-5 max-w-xl text-balance text-[2.65rem] font-bold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[4.1rem]">
                A private room that{" "}
                <span className="text-brand">disappears in an hour.</span>
              </h1>

              <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-muted-foreground sm:text-[17px]">
                Open a room, share the link, and talk. No account, no message
                history, and nothing left behind when the timer ends.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/create" className={primaryLink}>
                  Create a room
                  <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
                </Link>
                <Link href="/join" className={secondaryLink}>
                  <KeyRound className="size-4" strokeWidth={1.8} aria-hidden="true" />
                  Join with a code
                </Link>
              </div>

              <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck
                  className="size-3.5 text-brand"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                Free to use. No sign-up. Up to ten people per room.
              </p>
            </div>

            <div className="animate-rise">
              <RoomPreview />
            </div>
          </div>

          <ul
            aria-label="Room facts"
            className="-mx-4 mt-12 grid border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-line md:-mx-8"
          >
            {[
              "Rooms hold up to ten people.",
              "Every room is deleted after one hour.",
              "No account, email, or profile is required.",
            ].map((fact) => (
              <li
                key={fact}
                className="flex items-center border-b border-line px-4 py-5 last:border-b-0 sm:border-b-0 sm:py-6 md:px-8"
              >
                <p className="max-w-[16rem] text-sm leading-relaxed text-muted-foreground">
                  {fact}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <StripeDivider />

        <section
          id="how-it-works"
          aria-labelledby="how-it-works-heading"
          className="screen-line-bottom relative z-10 mx-auto w-full max-w-5xl border-line px-4 py-12 md:border-x md:px-8 md:py-16"
        >
          <div className="max-w-xl">
            <h2
              id="how-it-works-heading"
              className="text-balance text-2xl font-semibold tracking-[-0.025em] sm:text-3xl"
            >
              How a room works
            </h2>
            <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
              No settings and no admin panel. Create the room, send the link,
              and let the timer handle the rest.
            </p>
          </div>

          <div className="-mx-4 mt-8 grid border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-line md:-mx-8">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="group relative flex flex-col gap-3 border-b border-line px-4 py-6 last:border-b-0 hover:bg-card/40 sm:border-b-0 sm:px-6 md:px-8"
              >
                <span className="grid size-9 place-items-center rounded-lg border border-line bg-card text-brand shadow-xs">
                  <feature.icon
                    className="size-4"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </span>

                <h3 className="text-pretty text-[15px] font-semibold tracking-[-0.01em]">
                  {feature.title}
                </h3>
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
              No dashboards, no invites to manage, no settings to worry about.
              The room forgets everyone the same way.
            </p>
            <Link href="/create" className={secondaryLink}>
              Start a room
              <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <StripeDivider />

        <section
          aria-labelledby="closing-heading"
          className="relative z-10 mx-auto w-full max-w-5xl overflow-hidden border-line px-4 py-16 md:border-x md:px-8 md:py-20"
        >
          <div
            aria-hidden="true"
            className="dotted-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_50%_45%,black_6%,transparent_68%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-64 w-[34rem] -translate-x-1/2 rounded-full bg-brand/[0.07] blur-[100px]"
          />

          <div className="relative flex flex-col items-center text-center">
            <h2
              id="closing-heading"
              className="max-w-2xl text-balance text-3xl font-bold leading-[1.08] tracking-[-0.03em] sm:text-4xl md:text-[2.85rem]"
            >
              A private room, not a record.
            </h2>

            <p className="mt-4 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground">
              Shhh gives you an hour to say what you need to say. When the
              timer ends, the room and everything in it are gone.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/create" className={primaryLink}>
                Create a room
                <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
              </Link>
              <Link href="/join" className={secondaryLink}>
                I have a code
              </Link>
            </div>

            <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {["No sign-up", "No message history", "Automatic deletion"].map(
                (item) => (
                  <li key={item}>{item}</li>
                ),
              )}
            </ul>
          </div>
        </section>

        <footer className="relative z-10 mt-auto mx-auto w-full max-w-5xl border-t border-line px-4 pb-10 pt-10 md:border-x md:px-8 md:pb-12">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xs">
              <p className="text-base font-semibold tracking-[-0.02em]">Shhh</p>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                A private chat room that deletes itself after one hour.
              </p>
            </div>

            <nav aria-label="Footer navigation">
              <ul className="grid grid-cols-2 gap-x-10 gap-y-2.5 text-sm">
                <li>
                  <Link
                    href="/#how-it-works"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    How it works
                  </Link>
                </li>
                <li>
                  <Link
                    href="/create"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Create a room
                  </Link>
                </li>
                <li>
                  <Link
                    href="/join"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Join a room
                  </Link>
                </li>
                <li>
                  <Link
                    href="/"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Back to top
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          <div className="mt-9 -mx-4 flex flex-col gap-2 border-t border-line px-4 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:-mx-8 md:px-8">
            <p>© {new Date().getFullYear()} Shhh. No accounts. No history.</p>
            <p>Every room is temporary. That&apos;s the point.</p>
          </div>
        </footer>
      </main>
    </>
  )
}

function RoomPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-3 rounded-2xl bg-gradient-to-br from-brand/[0.08] via-transparent to-info/[0.06]"
      />

      <p className="sr-only">
        Preview of a Shhh room: people chatting under a countdown, with
        messages that disappear when the timer ends.
      </p>

      <div
        aria-hidden="true"
        className="surface-raised relative overflow-hidden rounded-xl border border-line bg-card"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-md border border-line bg-background">
              <MessageCircle className="size-3 text-brand" strokeWidth={1.8} />
            </span>
            <span className="truncate font-mono text-[11px] text-muted-foreground">
              x8Qm2Lk9Tt4
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 font-mono text-[11px] tabular-nums text-warning-foreground">
              <Clock3 className="size-3" />
              59:12
            </span>
            <span className="hidden items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[11px] text-muted-foreground min-[420px]:inline-flex">
              <span className="size-1.5 rounded-full bg-success" />
              2 online
            </span>
          </div>
        </div>

        <div className="space-y-4 px-3 py-5">
          <div className="flex items-start gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-brand/15 bg-brand-soft text-[10px] font-semibold text-brand">
              A
            </span>
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                Aster
              </p>
              <div className="max-w-[15rem] rounded-lg rounded-tl-sm border border-line bg-muted px-3 py-2 text-[13px] leading-relaxed text-foreground">
                Did you get the files?
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <div className="max-w-[16rem] rounded-lg rounded-tr-sm bg-primary px-3 py-2 text-[13px] leading-relaxed text-primary-foreground">
              Yes. Read them this morning.
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="font-mono tabular-nums">9:41</span>
              <CheckCheck className="size-3 text-brand" />
            </div>
          </div>

          <div className="flex items-start gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-brand/15 bg-brand-soft text-[10px] font-semibold text-brand">
              A
            </span>
            <div className="min-w-0">
              <div className="max-w-[16rem] rounded-lg rounded-tl-sm border border-line bg-muted px-3 py-2 text-[13px] leading-relaxed text-foreground">
                Good. Let&apos;s keep this off email.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pl-8 text-[11px] text-muted-foreground">
            <span className="flex items-end gap-[3px]">
              <span className="size-1 animate-typing rounded-full bg-brand" />
              <span className="size-1 animate-typing rounded-full bg-brand [animation-delay:150ms]" />
              <span className="size-1 animate-typing rounded-full bg-brand [animation-delay:300ms]" />
            </span>
            Aster is typing
          </div>
        </div>

        <div className="border-t border-line px-3 py-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-background py-1 pl-3 pr-1">
            <span className="flex-1 truncate text-[13px] text-muted-foreground">
              Type a message…
            </span>
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <span className="text-sm leading-none">↑</span>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <Ghost className="size-3" strokeWidth={1.8} aria-hidden="true" />
        Nothing is saved after the timer ends
      </div>
    </div>
  )
}
