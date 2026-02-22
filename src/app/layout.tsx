import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "b1nary — Set your price. Get paid.",
    template: "%s | b1nary",
  },
  description:
    "Pick a price you'd buy or sell ETH at. Earn premium upfront — no matter what happens. Fully collateralized options on Base.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    siteName: "b1nary",
    title: "b1nary — Set your price. Get paid.",
    description:
      "Pick a price you'd buy or sell ETH at. Earn premium upfront — no matter what happens. Fully collateralized options on Base.",
  },
  twitter: {
    card: "summary",
    title: "b1nary — Set your price. Get paid.",
    description:
      "Pick a price you'd buy or sell ETH at. Earn premium upfront — no matter what happens.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
