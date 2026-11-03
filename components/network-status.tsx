"use client"

import { useEffect, useRef, useState } from "react"
import { WifiOff } from "lucide-react"
import { showToast, toastSuccess, toastWarning } from "@/lib/toast"

/**
 * Connectivity awareness for the whole app.
 *
 * Transient toasts announce transitions (offline, back online, slow link);
 * a persistent banner stays visible for as long as the browser reports no
 * connection, so a user who missed the toast still knows why sending is
 * stuck. Drafts live in component state and are never cleared here.
 */

interface NetworkInformationLike extends EventTarget {
  effectiveType?: string
  downlink?: number
  rtt?: number
}

function getConnection(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined
  return (navigator as Navigator & { connection?: NetworkInformationLike })
    .connection
}

/** Conservative "this link will feel slow" check across browsers. */
function isSlowConnection(connection?: NetworkInformationLike): boolean {
  if (!connection) return false
  if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") {
    return true
  }
  if (typeof connection.downlink === "number" && connection.downlink < 0.5) {
    return true
  }
  return typeof connection.rtt === "number" && connection.rtt > 1_500
}

const SLOW_NOTICE_COOLDOWN_MS = 5 * 60_000

export function NetworkStatus() {
  const [offline, setOffline] = useState(false)
  const slowNoticedAtRef = useRef(0)
  const offlineAnnouncedRef = useRef(false)

  useEffect(() => {
    const announceOffline = () => {
      setOffline(true)
      if (offlineAnnouncedRef.current) return
      offlineAnnouncedRef.current = true
      void toastWarning({
        title: "You're offline",
        description:
          "Messages won't send until the connection returns. Nothing you typed is lost.",
      })
    }

    const announceOnline = () => {
      setOffline(false)
      offlineAnnouncedRef.current = false
      void toastSuccess({
        title: "Back online",
        description: "Reconnecting to the room…",
      })
    }

    const maybeAnnounceSlow = () => {
      if (!isSlowConnection(getConnection())) return
      const now = Date.now()
      if (now - slowNoticedAtRef.current < SLOW_NOTICE_COOLDOWN_MS) return
      slowNoticedAtRef.current = now
      void showToast("info", {
        title: "Slow connection",
        description:
          "Sending may take a moment. We'll keep your message on screen while it retries.",
      })
    }

    if (!navigator.onLine) announceOffline()
    else maybeAnnounceSlow()

    const connection = getConnection()

    window.addEventListener("offline", announceOffline)
    window.addEventListener("online", announceOnline)
    connection?.addEventListener("change", maybeAnnounceSlow)

    return () => {
      window.removeEventListener("offline", announceOffline)
      window.removeEventListener("online", announceOnline)
      connection?.removeEventListener("change", maybeAnnounceSlow)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/15 px-4 py-2 text-xs font-medium text-warning-foreground shadow-lg backdrop-blur">
        <WifiOff className="size-3.5" aria-hidden="true" />
        You&apos;re offline — messages will send when you reconnect.
      </div>
    </div>
  )
}
