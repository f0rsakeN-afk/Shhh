/**
 * Sanitizers for user-controlled text.
 *
 * Rendering is React's job (it escapes by construction), so these are
 * defense-in-depth at the storage boundary: remove markup so a future render
 * path that is not React cannot be attacked, and remove invisible characters
 * that would let one participant impersonate another or hide text in a name.
 */

/**
 * Zero-width and bidi-control characters. ZWJ (U+200D) is deliberately kept:
 * it is required for multi-codepoint emoji sequences. The rest are invisible
 * and exist only to reorder or disguise text.
 */
const INVISIBLE = /[\u200b\u200c\u200e\u200f\u2060\ufeff\u202a-\u202e\u2066-\u2069]/g
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g

/**
 * Sanitizes text by stripping HTML tags, control characters, and invisible
 * text-direction markers, then normalizing whitespace.
 *
 * @param text - The text to sanitize (can contain HTML)
 * @returns Plain text safe for DOM insertion
 */
export function sanitizeText(text: string): string {
  if (typeof text !== "string") return ""

  // 1. Strip HTML tags
  let result = text.replace(/<[^>]*>/g, "")

  // 2. Remove control/invisible characters (never renderable intent)
  result = result.replace(CONTROL, "").replace(INVISIBLE, "")

  // 3. Trim and normalize whitespace
  result = result.replace(/^\s+|\s+$/g, "").replace(/\s{2,}/g, " ")

  return result
}

/**
 * Sanitizes a username for safe display. NFKC folds compatibility lookalikes
 * (full-width letters, ligatures) onto their canonical form before the
 * quote/angle strip, so two visually identical names cannot both exist.
 */
export function sanitizeUsername(username: string): string {
  if (typeof username !== "string") return ""
  return sanitizeText(username.normalize("NFKC")).replace(/[<>'"]/g, "")
}

/**
 * Safe initials extraction
 */
export function safeGetInitials(username: string): string {
  if (!username) return "?"
  const parts = username.split("-")
  if (parts.length >= 2 && parts[1]) {
    const first = parts[1].charAt(0).replace(/[^a-zA-Z]/g, "")
    return first.toUpperCase()
  }
  return username.charAt(0).toUpperCase()
}
