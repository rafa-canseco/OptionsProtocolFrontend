import type { AppLocale } from "@/lib/preferences";

const SPANISH_SPEAKING_COUNTRIES = new Set([
  "AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "ES", "GQ", "GT",
  "HN", "MX", "NI", "PA", "PE", "PR", "PY", "SV", "UY", "VE",
]);

export function detectAppLocale({
  savedLocale,
  country,
  acceptedLanguage = "",
}: {
  savedLocale?: string;
  country?: string | null;
  acceptedLanguage?: string;
}): AppLocale {
  if (savedLocale === "es" || savedLocale === "en") return savedLocale;
  const normalizedCountry = country?.toUpperCase();
  return (normalizedCountry && SPANISH_SPEAKING_COUNTRIES.has(normalizedCountry)) || acceptedLanguage.toLowerCase().startsWith("es")
    ? "es"
    : "en";
}
