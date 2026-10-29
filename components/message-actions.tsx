"use client"

import { MoreHorizontal, Trash2 } from "lucide-react"
import { useCallback, useState } from "react"

interface MessageActionsProps {
  onDelete: () => void
}

export function MessageActions({ onDelete }: MessageActionsProps) {
  const [showMenu, setShowMenu] = useState(false)

  const toggleMenu = useCallback(() => {
    setShowMenu((value) => !value)
  }, [])

  const handleDelete = useCallback(() => {
    onDelete()
    setShowMenu(false)
  }, [onDelete])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleMenu}
        aria-label="Message actions"
        aria-expanded={showMenu}
        className="grid size-6 place-items-center rounded-md text-muted-foreground/60 opacity-0 transition-colors hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
      >
        <MoreHorizontal className="size-3.5" strokeWidth={1.8} />
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full z-40 mt-1.5 min-w-32 overflow-hidden rounded-lg border border-line bg-popover p-1 shadow-md">
          <button
            type="button"
            onClick={handleDelete}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs text-destructive-foreground transition-colors hover:bg-destructive/[0.08]"
          >
            <Trash2 className="size-3.5" strokeWidth={1.8} />
            Delete message
          </button>
        </div>
      )}
    </div>
  )
}
