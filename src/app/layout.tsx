import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getChainLabel, getHeroChainLine, isDevnet } from "@/lib/deployment";
import "./globals.css";

export const dynamic = "force-dynamic";

const chainLabel = getChainLabel();
const description = isDevnet()
  ? `Set your price on ${chainLabel}. Get paid upfront. Demo environment with mock assets and devnet liquidity.`
  : `Set your price on any asset. Get paid upfront. The volatility protocol for humans and AI agents. ${getHeroChainLine()}`;

export const metadata: Metadata = {
  title: {
    default: "b1nary · Turn volatility into income",
    template: "%s | b1nary",
  },
  description,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  other: {
    "base:app_id": "69a5b7c877bc7576330f4b09",
  },
  openGraph: {
    type: "website",
    siteName: "b1nary",
    title: "b1nary · Turn volatility into income",
    description,
  },
  twitter: {
    card: "summary",
    title: "b1nary · Turn volatility into income",
    description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="base:app_id" content="69a5b7c877bc7576330f4b09" />
      </head>
      <body>
        <Providers>
          <TooltipProvider>{children}</TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
