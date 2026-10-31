/**
 * Sanitizes text by stripping HTML tags and entities.
 * Used to prevent XSS when rendering user-generated content.
 *
 * @param text - The text to sanitize (can contain HTML)
 * @returns Plain text safe for DOM insertion
 */
export function sanitizeText(text: string): string {
  if (typeof text !== "string") return ""

  // 1. Strip HTML tags
  let result = text.replace(/<[^>]*>/g, "")

  // 2. Remove control characters
  result = result.replace(/[\u0000-\u001f]/g, "")

  // 3. Trim and normalize whitespace
  result = result.replace(/^\s+|\s+$/g, "").replace(/\s{2,}/g, " ")

  return result
}

/**
 * Sanitizes a username for safe display in HTML attributes and UI.
 */
export function sanitizeUsername(username: string): string {
  return sanitizeText(username).replace(/[<>'"]/g, "")
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