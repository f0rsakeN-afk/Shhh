"use client"

import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu"
import { cn } from "@/lib/utils"

interface MessageActionsProps {
  isOwnMessage?: boolean
  onCopy?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

/**
 * Hover-window message menu positioned just outside the bubble it belongs
 * to. Revealed with the message row on hover or keyboard focus; remains a
 * steady target on touch, where hover does not exist.
 */
export function MessageActions({
  isOwnMessage = false,
  onCopy,
  onEdit,
  onDelete,
}: MessageActionsProps) {
  if (!onCopy && !onEdit && !onDelete) return null

  const hasMenuItems = Boolean(onCopy || onEdit || onDelete)

  return (
    <div
      className={cn(
        "pointer-events-none absolute top-0 z-10",
        "opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100",
        isOwnMessage ? "right-full mr-1.5" : "left-full ml-1.5",
        !hasMenuItems && "hidden",
      )}
    >
      <Menu>
        <MenuTrigger
          aria-label="Message options"
          className="grid size-7 cursor-default select-none place-items-center rounded-md border border-line bg-card text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground sm:text-sm [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-popup-open:bg-accent data-popup-open:text-foreground"
        >
          <MoreHorizontal className="size-3.5" strokeWidth={1.8} />
        </MenuTrigger>
        <MenuPopup side={isOwnMessage ? "left" : "right"} align="start" sideOffset={6}>
          {onCopy && (
            <MenuItem
              onClick={onCopy}
              className="rounded-md px-2.5 py-1.5 text-[13px]"
            >
              <Copy className="size-3.5" />
              Copy text
            </MenuItem>
          )}
          {onEdit && (
            <MenuItem
              onClick={onEdit}
              className="rounded-md px-2.5 py-1.5 text-[13px]"
            >
              <Pencil className="size-3.5" />
              Edit message
            </MenuItem>
          )}
          {onDelete && (
            <MenuItem
              variant="destructive"
              onClick={onDelete}
              className="rounded-md px-2.5 py-1.5 text-[13px]"
            >
              <Trash2 className="size-3.5" />
              Delete message
            </MenuItem>
          )}
        </MenuPopup>
      </Menu>
    </div>
  )
}
