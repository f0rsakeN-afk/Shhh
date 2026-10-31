"use client"

/**
 * Browser notifications for incoming messages while the tab is hidden.
 * Browsers only grant permission in response to a user gesture, so the
 * room's "Enter room" button kickoff is the right moment to ask once.
 */

let permissionRequested = false

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }
  return Notification.permission
}

/**
 * Fire-and-forget permission request. Call it from a click handler so the
 * browser treats it as a gesture. Never blocks or throws.
 */
export function requestNotificationPermission(): void {
  if (permissionRequested) return
  permissionRequested = true

  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "default") return

  try {
    void Notification.requestPermission().catch(() => {})
  } catch {
    // Some browsers throw synchronously from requestPermission. Ignore.
  }
}

/**
 * Show a notification if the tab is hidden. Returns true when a notification
 * was actually created (callers can suppress their own UI in that case).
 */
export function notifyIfHidden(title: string, body: string): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false
  if (Notification.permission !== "granted") return false
  if (document.visibilityState !== "hidden") return false

  try {
    new Notification(title, {
      body,
      // The page itself is the trigger, so no separate icon asset is needed.
      silent: false,
      tag: "shhh-message",
    })
    navigator.vibrate?.([10, 40, 10])
    return true
  } catch {
    return false
  }
}
