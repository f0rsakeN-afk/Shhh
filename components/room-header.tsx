"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Bomb, Check, Copy, Link2, QrCode } from "lucide-react"
import { Brand } from "@/components/brand"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { CountdownTimer } from "./countdown-timer"
import { Spinner } from "@/components/ui/spinner"
import { toastError, toastSuccess } from "@/lib/toast"
import { cn } from "@/lib/utils"

interface RoomHeaderProps {
  roomId: string
  timeToLive?: number
  onDestroy: () => void
  onExpire?: () => void
  roomUrl: string
}

const iconButton =
  "grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

export function RoomHeader({
  roomId,
  timeToLive,
  onDestroy,
  onExpire,
  roomUrl,
}: RoomHeaderProps) {
  const [copied, setCopied] = useState<"id" | "link" | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const [qrSvg, setQrSvg] = useState("")
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The encoder is code-split rather than imported at module scope: most
  // room visits never open the dialog, so @paulmillr/qr stays out of the
  // room bundle entirely and is fetched only on first open. The SVG is
  // generated at the smallest module scale (CSS does the sizing), so the
  // ~24KB markup is created once and then reused while reopenings happen.
  useEffect(() => {
    if (!qrOpen) return

    let cancelled = false
    void import("@paulmillr/qr")
      .then(({ default: encodeQR }) => {
        if (cancelled) return
        setQrSvg(
          encodeQR(roomUrl, "svg", { ecc: "medium", border: 1, scale: 1 }),
        )
      })
      .catch(() => {
        if (!cancelled) setQrSvg("")
      })

    return () => {
      cancelled = true
    }
  }, [qrOpen, roomUrl])

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [])

  const copy = useCallback(async (value: string, type: "id" | "link") => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(type)

      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => setCopied(null), 2000)

      if (type === "id") {
        void toastSuccess({ title: "Room code copied" })
      } else {
        void toastSuccess({
          title: "Invite link copied",
          description: "Send it to the person you want in the room.",
        })
      }
    } catch {
      void toastError({
        title: "Could not copy",
        description: "Your browser blocked the clipboard. Select the text and copy it manually.",
      })
    }
  }, [])

  const copyRoomId = useCallback(() => {
    void copy(roomId, "id")
  }, [copy, roomId])

  const copyInviteLink = useCallback(() => {
    void copy(roomUrl, "link")
  }, [copy, roomUrl])

  return (
    <header className="relative z-30 shrink-0 border-b border-line bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-1.5 border-line px-3 sm:gap-2 md:border-x md:px-6">
        <Brand compact className="mr-0.5 shrink-0" />

        <span className="hidden h-5 w-px shrink-0 bg-line sm:block" />

        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="hidden text-xs text-muted-foreground lg:inline">
            Room
          </span>
          <code
            title={roomId}
            className="max-w-[72px] truncate rounded-md border border-line bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground min-[420px]:max-w-[120px] sm:max-w-[200px]"
          >
            {roomId}
          </code>
          <button
            type="button"
            onClick={copyRoomId}
            aria-label={copied === "id" ? "Room code copied" : "Copy room code"}
            title="Copy room code"
            className={iconButton}
          >
            {copied === "id" ? (
              <Check className="size-3.5 text-success" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <CountdownTimer initialTtl={timeToLive} onExpire={onExpire} />

          <button
            type="button"
            onClick={copyInviteLink}
            aria-label={copied === "link" ? "Invite link copied" : "Copy invite link"}
            title="Copy invite link"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-line px-2 text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-2.5"
          >
            {copied === "link" ? (
              <>
                <Check className="size-3.5 text-success" aria-hidden="true" />
                <span className="hidden sm:inline">Copied</span>
              </>
            ) : (
              <>
                <Link2 className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                <span className="hidden sm:inline">Share</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setQrOpen(true)}
            aria-label="Show QR code for the invite link"
            title="Show QR code"
            className={iconButton}
          >
            <QrCode className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          </button>

          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <DialogPopup aria-describedby="qr-share-description">
              <DialogHeader>
                <DialogTitle>Scan to join</DialogTitle>
                <DialogDescription id="qr-share-description">
                  Point a phone camera at the code. It opens this room&apos;s
                  invite link — the same place the room code leads, until the
                  timer ends.
                </DialogDescription>
              </DialogHeader>

              <DialogPanel>
                <div className="flex flex-col items-center gap-3">
                  {/* Black on white regardless of theme: cameras read the
                      canonical polarity best and the SVG has no theme
                      awareness. */}
                  <div className="grid aspect-square w-full max-w-[240px] place-items-center rounded-lg border border-line bg-white p-3 [&_svg]:h-auto [&_svg]:w-full [&_rect]:fill-black">
                    {qrSvg ? (
                      // Library-generated SVG from our own room URL; no
                      // user-controlled markup reaches this sink.
                      <div className="w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                    ) : (
                      <Spinner className="size-5 text-black/40" />
                    )}
                  </div>
                  <code className="max-w-full break-all px-2 text-center font-mono text-[11px] text-muted-foreground">
                    {roomUrl}
                  </code>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {copied === "link" ? (
                      <Check className="size-4 text-success" aria-hidden="true" />
                    ) : (
                      <Copy className="size-4" strokeWidth={1.8} aria-hidden="true" />
                    )}
                    {copied === "link" ? "Link copied" : "Copy invite link"}
                  </button>
                </div>
              </DialogPanel>
            </DialogPopup>
          </Dialog>

          <ThemeToggle className="size-8" />

          <AlertDialog>
            <AlertDialogTrigger
              aria-label="Destroy room"
              title="Destroy room now"
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-line px-2 text-xs text-destructive-foreground transition-colors duration-150 hover:border-destructive/30 hover:bg-destructive/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-3",
              )}
            >
              <Bomb className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
              <span className="hidden sm:inline">Destroy</span>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Destroy this room?</AlertDialogTitle>
                <AlertDialogDescription className="leading-relaxed">
                  This permanently deletes the room and every message for all
                  participants. It ends immediately for the other person too,
                  and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogClose
                  className="inline-flex min-h-9 items-center justify-center rounded-md border border-line px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Keep it
                </AlertDialogClose>
                <AlertDialogClose
                  onClick={onDestroy}
                  className="inline-flex min-h-9 items-center justify-center rounded-md border border-destructive/40 bg-destructive/[0.08] px-4 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Destroy now
                </AlertDialogClose>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </header>
  )
}
