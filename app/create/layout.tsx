import type { Metadata } from "next";

const title = "Create a private room";
const description =
  "Open a private chat room in one click. No account, no email, no history. The room and everything in it disappear after one hour.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/create",
  },
  openGraph: {
    url: "/create",
    title,
    description,
  },
  twitter: {
    title,
    description,
  },
};

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
