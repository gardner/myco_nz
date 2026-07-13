import type { Metadata } from "next";
import "./globals.css";

import { buildRootMetadata } from "@/lib/social-metadata";

export const metadata: Metadata = buildRootMetadata("");

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NZ">
      <body>{children}</body>
    </html>
  );
}
