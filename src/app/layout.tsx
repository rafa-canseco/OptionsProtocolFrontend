import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "b1nary — Set your price. Get paid.",
  description: "Pick a price you'd buy or sell ETH at. Earn money while you wait.",
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
