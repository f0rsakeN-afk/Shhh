"use client"

import { Moon, Sun } from "lucide-react"
import { useEffect } from "react"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
      return target.isContentEditable
    }

    const handler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || event.repeat) return

      const isShortcut =
        event.key.toLowerCase() === "d" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey

      if (isShortcut) {
        event.preventDefault()
        toggleTheme()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [toggleTheme])

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        isDark ? "Switch to light mode (D)" : "Switch to dark mode (D)"
      }
      aria-keyshortcuts="D"
      title={isDark ? "Switch to light mode (D)" : "Switch to dark mode (D)"}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60",
        className,
      )}
    >
      <span className="relative flex size-4 items-center justify-center">
        <Sun className="absolute size-4 rotate-90 scale-0 transition-[transform,opacity] duration-200 dark:rotate-0 dark:scale-100" />
        <Moon className="absolute size-4 rotate-0 scale-100 transition-[transform,opacity] duration-200 dark:-rotate-90 dark:scale-0" />
      </span>
    </button>
  )
}
