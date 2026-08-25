import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { LandingPage } from "@/components/landing/LandingPage";
import { detectAppLocale } from "@/lib/locale";

const title = "b1nary · Automated investment strategies";
const description =
  "Explore simple, automated investment strategies built around familiar markets and clearly defined outcomes.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  openGraph: {
    type: "website",
    siteName: "b1nary",
    title,
    description,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default async function Home() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const initialLocale = detectAppLocale({
    savedLocale: cookieStore.get("b1nary-locale")?.value,
    country: requestHeaders.get("x-vercel-ip-country"),
    acceptedLanguage: requestHeaders.get("accept-language") ?? "",
  });

  return <LandingPage initialLocale={initialLocale} />;
}
