/**
 * Static factual content for the landing page.
 * Rendered server-first: no "use client", no hooks, no runtime state.
 * Imported by HeroLanding for the static sections (features, how it works,
 * closing, footer). This reduces the client-side JavaScript payload.
 */

/** Feature descriptions shown in the "Room facts" section. */
export const FACTS = [
  "Rooms hold up to ten people.",
  "Pick 15 minutes, an hour, or a whole day at creation.",
  "No account, email, or profile is required.",
] as const

/** Feature objects used in the "How a room works" section. */
export const FEATURES = [
  {
    title: "Create a room",
    body:
      "One click opens a private room and starts the clock. There is nothing to install and nothing to configure.",
  },
  {
    title: "Send one link",
    body:
      "The link is the only invite. Up to ten people can be in the room, and everyone arrives with a name already suggested.",
  },
  {
    title: "Let it close",
    body:
      "When the timer you chose runs out — 15 minutes, an hour, or a day later — the room and every message inside it are deleted. Nothing is archived or recoverable.",
  },
] as const

/** How-it-works paragraph text. */
export const HOW_IT_WORKS =
  "No settings and no admin panel. Create the room, send the link, and let the timer handle the rest."

/** Closing section heading and body. */
export const CLOSING_HEADING = "A private room, not a record."
export const CLOSING_BODY =
  "Shhh gives you an hour to say what you need to say. When the timer ends, the room and everything in it are gone."

/** Footer navigation links. */
export const FOOTER_NAV = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Join a room", onClick: undefined }, // handled by client
  { label: "Back to top", href: "/" },
] as const

/** Duration label mapping. */
export const DURATION_LABELS = {
  "15m": "15 min",
  "1h": "1 hour",
  "24h": "24 hours",
}

/** Copyright notice text. */
export const COPYRIGHT_YEAR = new Date().getFullYear()
export const COPYRIGHT_TEXT = `© ${new Date().getFullYear()} Shhh. No accounts. No history.`