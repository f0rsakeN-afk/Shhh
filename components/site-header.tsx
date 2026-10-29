"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface SiteHeaderProps {
  variant?: "marketing" | "app";
  className?: string;
}

const navItems = [
  { title: "How it works", href: "/#how-it-works", match: "/" },
  { title: "Join a room", href: "/join", match: "/join" },
];

export function SiteHeader({
  variant = "marketing",
  className,
}: SiteHeaderProps) {
  const pathname = usePathname();

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 w-full overflow-x-hidden border-b border-line bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/65",
          className,
        )}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 border-line px-3 md:border-x md:px-8">
          <div className="flex min-w-0 items-center gap-3 md:gap-5">
            <Brand />

            {variant === "marketing" && (
              <nav
                aria-label="Main navigation"
                className="flex items-center gap-0.5"
              >
                {navItems.map((item) => {
                  const isActive =
                    item.match === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.match);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "rounded-md px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        item.match === "/" && "hidden sm:inline-flex",
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {item.title}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Link
              href={variant === "marketing" ? "/create" : "/"}
              className="ml-0.5 inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-primary bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-3.5"
            >
              {variant === "marketing" ? "New room" : "Home"}
            </Link>
          </div>
        </div>
      </header>
      {/* Reserves the fixed header's flow space. */}
      <div className="h-14 w-full" aria-hidden="true" />
    </>
  );
}
