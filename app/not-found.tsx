import Link from "next/link";
import { ArrowLeft, Ghost } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { CreateRoomButton } from "@/components/create-room-button";
import { JoinRoomProvider } from "@/components/join-room";

export default function NotFound() {
  return (
    <JoinRoomProvider>
      <SiteHeader />
      <main
        id="main-content"
        className="flex min-h-[calc(100dvh-3.5rem)] flex-col overflow-x-clip"
      >
        <section className="screen-line-top screen-line-bottom relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center border-line px-4 py-16 md:border-x md:px-8 md:py-24">
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <span className="grid size-12 place-items-center rounded-xl border border-line bg-card text-brand shadow-xs">
              <Ghost className="size-5" strokeWidth={1.8} aria-hidden="true" />
            </span>

            <p className="mt-6 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Error 404
            </p>

            <h1 className="mt-3 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              This page has already vanished.
            </h1>

            <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
              It may have expired, or it may never have existed. Either way,
              there is nothing left here to find.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-primary bg-primary px-5 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back home
              </Link>
              <CreateRoomButton className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-background px-5 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60">
                Create a room
              </CreateRoomButton>
            </div>
          </div>
        </section>
      </main>
    </JoinRoomProvider>
  );
}
