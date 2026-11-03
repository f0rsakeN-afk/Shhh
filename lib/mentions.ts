/**
 * Mention tokenizer for message rendering.
 *
 * Splitting lives in a pure function so the tricky boundaries (starts of
 * lines, punctuation, trailing dots, emails) are unit-tested instead of
 * living inside JSX. The renderer only maps segments to spans.
 */

export type MentionSegmentKind = "text" | "mention" | "self"

export interface MentionSegment {
  kind: MentionSegmentKind
  text: string
}

/**
 * A mention starts at the beginning of the text or after whitespace/opening
 * punctuation, and names may contain letters (any script), digits, `_`, `-`
 * and internal dots (e.g. nickname segments). A trailing dot is treated as
 * sentence punctuation, and an email's `@` is NOT a mention because it has
 * a word character directly before it.
 */
const MENTION_RE =
  /(^|[\s([{'"])@([\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)*)/gu

/**
 * Splits a message body into plain-text and mention segments. `@name`
 * matching the reader's own name becomes `"self"` so the UI can emphasize
 * being addressed without changing what the text says.
 */
export function splitMentions(
  text: string,
  currentUsername?: string,
): MentionSegment[] {
  if (!text) return []

  const segments: MentionSegment[] = []
  const re = new RegExp(MENTION_RE.source, MENTION_RE.flags)
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    const [full, lead, name] = match
    const mentionStart = match.index + lead.length

    if (mentionStart > lastIndex) {
      segments.push({ kind: "text", text: text.slice(lastIndex, mentionStart) })
    }

    segments.push({
      kind: currentUsername && name === currentUsername ? "self" : "mention",
      text: `@${name}`,
    })

    lastIndex = mentionStart + full.length - lead.length
  }

  if (lastIndex < text.length) {
    segments.push({ kind: "text", text: text.slice(lastIndex) })
  }

  return segments
}
