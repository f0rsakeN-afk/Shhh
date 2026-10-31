"use client"

import dynamic from "next/dynamic"
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover"
import { useTheme } from "@/components/theme-provider"

/**
 * emoji-picker-react, code-split so the library is fetched only when a
 * popover actually opens; the composer bundle stays lean.
 */
const EmojiPickerReact = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => <div className="w-[320px]" aria-hidden="true" />,
})

interface EmojiPaletteProps {
  /** Selection handler; receives a single emoji character. */
  onPick: (emoji: string) => void
  /** Compact density for reaction bars; standard for the composer. */
  size?: "sm" | "md"
}

/**
 * The full categorized, searchable emoji picker: reading the room's resolved
 * theme and rendering native emoji glyphs, which need no image requests and
 * match the text chips used elsewhere in the room.
 */
export function EmojiPalette({ onPick, size = "md" }: EmojiPaletteProps) {
  const { resolvedTheme } = useTheme()

  return (
    <EmojiPickerReact
      onEmojiClick={(data) => onPick(data.emoji)}
      colorScheme={resolvedTheme}
      // Native glyphs only: no CDN sprite fetches, so nothing is blocked by
      // the app CSP and nothing waits on the network.
      emojiStyle="native"
      width={size === "sm" ? 320 : 360}
      height={size === "sm" ? 320 : 380}
      previewConfig={{ showPreview: false }}
    />
  )
}

interface EmojiPickerProps {
  /** Insert handler; receives a single emoji. */
  onPick: (emoji: string) => void
  /** Which side of the picker should line up with its trigger. */
  align?: "start" | "end"
  /** Fully styled trigger classes (mirrors Button ghost icon). */
  triggerClassName?: string
  children: React.ReactNode
  label?: string
}

/**
 * Popover wrapper around the palette, used by the composer toolbar.
 */
export function EmojiPicker({
  onPick,
  align = "start",
  triggerClassName,
  children,
  label = "Pick an emoji",
}: EmojiPickerProps) {
  return (
    <Popover>
      <PopoverTrigger aria-label={label} className={triggerClassName}>
        {children}
      </PopoverTrigger>
      <PopoverPopup
        side="top"
        align={align}
        sideOffset={8}
        className="overflow-hidden p-0 [&_button]:select-none"
      >
        <EmojiPalette onPick={onPick} />
      </PopoverPopup>
    </Popover>
  )
}
