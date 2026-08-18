"use client";

import { Moon, Sun } from "lucide-react";
import { useAppPreferences } from "@/lib/preferences";

export function AppPreferenceControls({ vault = false }: { vault?: boolean }) {
  const { theme, locale, toggleTheme, toggleLocale } = useAppPreferences();
  const border = vault ? "var(--vault-border)" : "var(--border)";
  const text = vault ? "var(--vault-text-muted)" : "var(--text-secondary)";
  const active = vault ? "var(--vault-text)" : "var(--text)";

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={locale === "es" ? `Cambiar a modo ${theme === "light" ? "oscuro" : "claro"}` : `Switch to ${theme === "light" ? "dark" : "light"} mode`}
        className="grid size-9 place-items-center rounded-full border transition-colors hover:bg-[var(--surface)] sm:size-10"
        style={{ borderColor: border, color: text }}
      >
        {theme === "light" ? <Moon className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />}
      </button>
      <button
        type="button"
        onClick={toggleLocale}
        aria-label={locale === "en" ? "Cambiar a español" : "Switch to English"}
        className="grid h-9 min-w-9 place-items-center rounded-full border px-1.5 font-mono text-[11px] font-semibold transition-colors hover:bg-[var(--surface)] sm:h-10 sm:min-w-10 sm:px-2 sm:text-xs"
        style={{ borderColor: border, color: active }}
      >
        {locale === "en" ? "ES" : "EN"}
      </button>
    </div>
  );
}
