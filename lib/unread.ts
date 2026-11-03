"use client"

/**
 * Unread count in the tab title while the room tab is hidden or unfocused.
 * With ten-person rooms, messages arrive while you are elsewhere; the title
 * is the one UI surface that follows the tab, so it carries the count until
 * you come back. The base title is captured before the first bump and
 * restored on clear, so Next's metadata title is never permanently lost.
 */

let baseTitle: string | null = null
let unreadCount = 0

/** Strips any previously applied "(n) " prefix from a title. */
function stripBadge(title: string): string {
  return title.replace(/^\(\d+\)\s*/, "")
}

/** Capture the page's real title. Safe to call on every room mount. */
export function initUnreadBadge(): void {
  if (typeof document === "undefined") return
  baseTitle = stripBadge(document.title)
  unreadCount = 0
}

/** Count one message that arrived while the user was not looking at the tab. */
export function bumpUnread(): void {
  if (typeof document === "undefined") return
  if (baseTitle === null) baseTitle = stripBadge(document.title)

  unreadCount += 1
  document.title = `(${unreadCount}) ${baseTitle}`
}

/** Clear the count and restore the title. */
export function clearUnread(): void {
  if (typeof document === "undefined") return
  unreadCount = 0
  if (baseTitle !== null) document.title = baseTitle
}

/** True when the tab is hidden or the window is not focused. */
export function isAwayFromTab(): boolean {
  if (typeof document === "undefined") return false
  return document.visibilityState !== "visible" || !document.hasFocus()
}
