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
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("labels familiar markets as illustrative examples", () => {
    render(<LandingPage />);

    expect(screen.getByLabelText(/illustrative markets/i)).toBeInTheDocument();
    expect(screen.getByText(/examples only\. availability may vary/i)).toBeInTheDocument();
    expect(screen.getAllByText("TSLA")).not.toHaveLength(0);
    expect(screen.getAllByText("AAPL")).not.toHaveLength(0);
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

    expect(screen.getByRole("link", { name: /open app/i })).toHaveAttribute("href", "/vaults");
    const appLinks = screen.getAllByRole("link", { name: /view strategies/i });
    expect(appLinks.length).toBeGreaterThan(0);
    for (const link of appLinks) expect(link).toHaveAttribute("href", "/vaults");
  });

  it("keeps the illustrative review chrome out of the tab order", () => {
    const { container } = render(<LandingPage />);
    const hiddenPreview = Array.from(container.querySelectorAll('[aria-hidden="true"]'))
      .find((element) => element.textContent?.includes("Illustrative review"));
    expect(hiddenPreview).toBeDefined();
    expect(hiddenPreview?.querySelector("button, a, input, select, textarea")).toBeNull();
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
