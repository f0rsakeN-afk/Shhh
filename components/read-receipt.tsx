"use client"

import { CheckCheck } from "lucide-react"
import { ReadReceipt } from "@/lib/schemas"

interface ReadReceiptProps {
  readBy: ReadReceipt[]
  currentUsername: string
  otherUsername?: string
}

export function ReadReceiptIndicator({
  readBy,
  currentUsername,
  otherUsername,
}: ReadReceiptProps) {
  if (!readBy || readBy.length === 0) return null

  const isReadByOther = otherUsername
    ? readBy.some((r) => r.username === otherUsername)
    : readBy.some((r) => r.username !== currentUsername)

  if (!isReadByOther) return null

  return (
    <div className="flex items-center gap-1 text-brand" title="Read">
      <CheckCheck className="size-3" strokeWidth={2} />
      <span className="text-[10.5px] text-muted-foreground">Read</span>
    </div>
  )
}
