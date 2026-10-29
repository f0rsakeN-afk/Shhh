"use client"

import { MoreHorizontal, Trash2 } from "lucide-react"
import { useCallback } from "react"
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu"
import { cn } from "@/lib/utils"

interface MessageActionsProps {
  onDelete: () => void
}

export function MessageActions({ onDelete }: MessageActionsProps) {
  const handleDelete = useCallback(() => {
    onDelete()
  }, [onDelete])

  return (
    <Menu>
      <MenuTrigger
        aria-label="Message actions"
        className={cn(
          "flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-base outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:ps-8 data-[variant=destructive]:text-destructive-foreground data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:text-sm [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 transition-colors duration-150 pointer-coarse:size-8 pointer-coarse:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background group-hover:opacity-100 data-popup-open:bg-accent data-popup-open:text-foreground data-popup-open:opacity-100",
        )}
      >
        <MoreHorizontal className="size-3.5" strokeWidth={1.8} />
      </MenuTrigger>
      <MenuPopup side="bottom" align="end" sideOffset={6}>
        <MenuItem
          variant="destructive"
          onClick={handleDelete}
          className="rounded-md px-2.5 py-1.5 text-[13px]"
        >
          <Trash2 className="size-3.5" />
          Delete message
        </MenuItem>
      </MenuPopup>
    </Menu>
  )
}