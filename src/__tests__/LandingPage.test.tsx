import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LandingPage } from "@/components/landing/LandingPage";

const prohibitedCopy = [
  "onchain",
  "crosschain",
  "blockchain",
  "smart contract",
  "cash-secured put",
  "covered call",
  "strike",
  "premium",
  "assignment",
  "collateral",
  "market maker",
];

describe("LandingPage", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.landingTheme;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
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
  });

  it("presents the retail positioning and three strategy families", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /your investments.*autopilot/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Strategic Entry" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Income Strategy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Automatic Cycle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous strategy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next strategy" })).toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("does not advertise illustrative tickers", () => {
    render(<LandingPage />);

    expect(screen.queryByText(/examples only\. availability may vary/i)).not.toBeInTheDocument();
    expect(screen.queryByText("TSLA")).not.toBeInTheDocument();
    expect(screen.queryByText("NVDA")).not.toBeInTheDocument();
  });

  it("keeps implementation and derivatives terminology out of user-facing copy", () => {
    const { container } = render(<LandingPage />);
    const copy = container.textContent?.toLowerCase() ?? "";

    for (const term of prohibitedCopy) {
      expect(copy).not.toContain(term);
    }
  });

  it("localizes the landing content and navigation labels in Spanish", () => {
    const { container } = render(<LandingPage initialLocale="es" />);

    expect(container.firstElementChild).toHaveAttribute("lang", "es");
    expect(screen.getByRole("button", { name: /cambiar al modo oscuro/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /abrir navegación/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /navegación principal/i })).toBeInTheDocument();
  });

  it("persists the selected landing theme", () => {
    const { container } = render(<LandingPage />);
    const landing = container.firstElementChild;

    expect(landing).toHaveAttribute("data-theme", "light");
    fireEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }));
    expect(landing).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem("b1nary-landing-theme")).toBe("dark");
    expect(document.documentElement.dataset.landingTheme).toBe("dark");
  });

  it("restores a persisted dark theme before interaction", () => {
    window.localStorage.setItem("b1nary-landing-theme", "dark");
    const { container } = render(<LandingPage />);
    expect(container.firstElementChild).toHaveAttribute("data-theme", "dark");
  });

  it("provides working navigation to the existing application", () => {
    render(<LandingPage />);

    const openAppLinks = screen.getAllByRole("link", { name: /open app/i });
    expect(openAppLinks.length).toBeGreaterThan(0);
    for (const link of openAppLinks) expect(link).toHaveAttribute("href", "/vaults");
    expect(screen.getByRole("link", { name: /view strategies/i })).toHaveAttribute("href", "/vaults");
  });

  it("uses accessible expandable FAQ controls", () => {
    render(<LandingPage />);

    const question = screen.getByRole("button", {
      name: /are returns guaranteed/i,
    });
    expect(question).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(question);
    expect(question).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/every strategy carries market risk/i)).toBeVisible();
  });
});
