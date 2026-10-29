import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Private room",
  description:
    "A private Shhh room. Messages disappear with the room when its timer ends.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
