import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life Ledger",
  description: "A calm personal operating system for goals, health, finance, learning, and reflection.",
  applicationName: "Life Ledger",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/life-ledger-logo.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
