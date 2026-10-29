const AVATAR_TONES = [
  "border-brand/25 bg-brand/10 text-brand",
  "border-blue-600/20 bg-blue-500/10 text-blue-700 dark:border-blue-400/20 dark:text-blue-300",
  "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-300",
  "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-300",
  "border-amber-600/25 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:text-amber-300",
  "border-rose-600/20 bg-rose-500/10 text-rose-700 dark:border-rose-400/20 dark:text-rose-300",
] as const

export function getUserColor(username: string) {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }

  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length]
}

export function getInitials(username: string): string {
  if (!username) return "?"
  const parts = username.split("-")
  if (parts.length >= 2 && parts[1]) {
    return parts[1].charAt(0).toUpperCase()
  }
  return username.charAt(0).toUpperCase()
}
