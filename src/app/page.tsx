import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { LandingPage } from "@/components/landing/LandingPage";

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

const themeBootstrap = `
  try {
    const theme = localStorage.getItem("b1nary-landing-theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.landingTheme = theme;
    }
  } catch {}
`;

const spanishSpeakingCountries = new Set([
  "AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "ES", "GQ", "GT",
  "HN", "MX", "NI", "PA", "PE", "PR", "PY", "SV", "UY", "VE",
]);

export default async function Home() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const savedLocale = cookieStore.get("b1nary-locale")?.value;
  const country = requestHeaders.get("x-vercel-ip-country")?.toUpperCase();
  const acceptedLanguage = requestHeaders.get("accept-language")?.toLowerCase() ?? "";
  const detectedLocale =
    (country && spanishSpeakingCountries.has(country)) || acceptedLanguage.startsWith("es")
      ? "es"
      : "en";
  const initialLocale = savedLocale === "es" || savedLocale === "en" ? savedLocale : detectedLocale;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      <LandingPage initialLocale={initialLocale} />
    </>
  );
}
