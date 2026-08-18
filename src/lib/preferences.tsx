"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";

export type AppTheme = "light" | "dark";
export type AppLocale = "en" | "es";

const THEME_KEY = "b1nary-landing-theme";

type PreferencesValue = {
  theme: AppTheme;
  locale: AppLocale;
  setTheme: (theme: AppTheme) => void;
  setLocale: (locale: AppLocale) => void;
  toggleTheme: () => void;
  toggleLocale: () => void;
};

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function AppPreferencesProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: AppLocale;
}) {
  const [theme, setThemeState] = useState<AppTheme>("light");
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  useLayoutEffect(() => {
    const rootTheme = document.documentElement.dataset.landingTheme;
    if (rootTheme === "light" || rootTheme === "dark") {
      setThemeState(rootTheme);
      document.documentElement.classList.toggle("dark", rootTheme === "dark");
    }
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<PreferencesValue>(() => {
    const applyTheme = (next: AppTheme) => {
      setThemeState(next);
      window.localStorage.setItem(THEME_KEY, next);
      document.documentElement.dataset.landingTheme = next;
      document.documentElement.classList.toggle("dark", next === "dark");
    };
    const applyLocale = (next: AppLocale) => {
      setLocaleState(next);
      document.cookie = `b1nary-locale=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
    };
    return {
      theme,
      locale,
      setTheme: applyTheme,
      setLocale: applyLocale,
      toggleTheme: () => applyTheme(theme === "light" ? "dark" : "light"),
      toggleLocale: () => applyLocale(locale === "en" ? "es" : "en"),
    };
  }, [locale, theme]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useAppPreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("useAppPreferences must be used inside AppPreferencesProvider");
  return value;
}
