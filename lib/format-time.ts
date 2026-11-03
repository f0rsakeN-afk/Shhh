/**
 * Time formatting through the platform Intl API.
 *
 * These replace date-fns for the three tiny formats the app actually used
 * (`MMMM d` and two `HH:mm` clock labels). `Intl.DateTimeFormat` instances
 * are created once per module and reused, so rendering a transcript costs no
 * formatter construction — and dropping date-fns removes ~30KB of parsing
 * and locale machinery from the room bundle for formats the platform already
 * ships natively.
 */

/** "March 4" — the day label above a transcript section. */
const monthDay = new Intl.DateTimeFormat(undefined, {
  month: "long",
  day: "numeric",
})

/** 24-hour "14:05" — tabular clock labels never carry an AM/PM suffix. */
const clock = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

export function formatMonthDay(timestamp: number): string {
  return monthDay.format(timestamp)
}

export function formatClock(timestamp: number): string {
  return clock.format(timestamp)
}
