export const siteConfig = {
  name: "Shhh",
  title: "Shhh · Private rooms that vanish",
  shortTitle: "Shhh",
  description:
    "Private, self-destructing chat rooms that disappear after one hour. No accounts, no history, no trail. Just a quiet place to talk.",
  shortDescription:
    "A private chat room that lives for one hour and leaves nothing behind.",
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
    "one hour chat",
    "no sign up chat",
    "disappearing messages",
  ],
} as const
