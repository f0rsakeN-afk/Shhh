import type { Metadata } from "next";

const title = "Join a room";
const description =
  "Join a private, self-destructing chat room with a single code. No sign-up, no install, and nothing left behind when the timer ends.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/join",
  },
  openGraph: {
    url: "/join",
    title,
    description,
  },
  twitter: {
    title,
    description,
  },
};

export default function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
