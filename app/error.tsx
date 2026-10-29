"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        className="flex min-h-[calc(100dvh-3.5rem)] flex-col overflow-x-clip"
      >
        <section className="screen-line-top screen-line-bottom relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center border-line px-4 py-16 md:border-x md:px-8 md:py-24">
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Something went quiet
            </p>

            <h1 className="mt-3 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              We lost the thread.
            </h1>

            <p
              role="alert"
              className="mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground"
            >
              An unexpected error interrupted the page. Try again. If the room
              is gone, its timer probably ran out.
            </p>

            <button
              type="button"
              onClick={reset}
              className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-primary bg-primary px-5 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        </section>
      </main>
    </>
  );
}
