export const siteConfig = {
  name: "Shhh",
  title: "Shhh · Private rooms that vanish",
  shortTitle: "Shhh",
  description:
    "Private, self-destructing chat rooms that vanish on your schedule — 15 minutes, an hour, or a day. No accounts, no history, no trail. Just a quiet place to talk.",
  shortDescription:
    "A private chat room that self-destructs on your schedule and leaves nothing behind.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://mercurius-five.vercel.app",
  locale: "en_US",
  keywords: [
    "private chat room",
    "temporary chat",
    "self-destructing messages",
    "anonymous chat",
    "ephemeral messaging",
    "temporary chat room",
    "no sign up chat",
    "disappearing messages",
  ],
} as const
