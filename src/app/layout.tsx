import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Providers } from "@/lib/providers";
import { AppPreferencesProvider } from "@/lib/preferences";
import { detectAppLocale } from "@/lib/locale";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@blossom-carousel/react/style.css";
import "./globals.css";

export const dynamic = "force-dynamic";

const description =
  "Set your price on any asset. Get paid upfront. The volatility protocol for humans and AI agents.";

const themeBootstrap = `
  try {
    const saved = localStorage.getItem("b1nary-landing-theme");
    const theme = saved === "light" || saved === "dark"
      ? saved
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.landingTheme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  } catch {}
`;

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const initialLocale = detectAppLocale({
    savedLocale: cookieStore.get("b1nary-locale")?.value,
    country: requestHeaders.get("x-vercel-ip-country"),
    acceptedLanguage: requestHeaders.get("accept-language") ?? "",
  });

  return (
    <html lang={initialLocale} suppressHydrationWarning>
      <head>
        <meta name="base:app_id" content="69a5b7c877bc7576330f4b09" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <AppPreferencesProvider initialLocale={initialLocale}>
          <Providers>
            <TooltipProvider>{children}</TooltipProvider>
          </Providers>
        </AppPreferencesProvider>
      </body>
    </html>
  );
}
