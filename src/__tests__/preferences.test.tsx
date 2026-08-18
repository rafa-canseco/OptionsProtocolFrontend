import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AppPreferenceControls } from "@/components/AppPreferenceControls";
import { AppPreferencesProvider } from "@/lib/preferences";

describe("AppPreferenceControls", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    document.documentElement.dataset.landingTheme = "light";
    document.documentElement.lang = "en";
  });

  it("persists and applies the selected theme", () => {
    render(<AppPreferencesProvider><AppPreferenceControls /></AppPreferencesProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));

    expect(document.documentElement.dataset.landingTheme).toBe("dark");
    expect(window.localStorage.getItem("b1nary-landing-theme")).toBe("dark");
  });

  it("switches the application locale", () => {
    render(<AppPreferencesProvider><AppPreferenceControls /></AppPreferencesProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Cambiar a español" }));

    expect(document.documentElement.lang).toBe("es");
    expect(screen.getByRole("button", { name: "Switch to English" })).toHaveTextContent("EN");
  });
});
