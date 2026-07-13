import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nearby Fungi | Fungi recorded around you",
  description:
    "See fungi most often recorded near your approximate area at this time of year.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NZ">
      <body>{children}</body>
    </html>
  );
}
