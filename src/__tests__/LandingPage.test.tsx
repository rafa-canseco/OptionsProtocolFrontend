import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LandingPage } from "@/components/landing/LandingPage";

vi.mock("@/hooks/usePrices", () => ({
  usePrices: () => ({ prices: [], loading: false }),
}));
vi.mock("@/hooks/useCoinGeckoSpot", () => ({
  useCoinGeckoSpot: () => ({ spot: undefined, loading: false }),
}));
vi.mock("@/hooks/useSpot", () => ({
  useSpot: () => ({ spot: undefined, loading: false }),
}));

describe("LandingPage", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN;
    delete process.env.NEXT_PUBLIC_DEPLOYMENT_ENV;
    delete process.env.NEXT_PUBLIC_FEATURED_ASSET;
  });

  it("renders the AssetsStrip with the four supported assets", () => {
    render(<LandingPage />);
    const assetsList = screen.getByLabelText(/tslax on solana, new/i).closest("ul");
    expect(assetsList).not.toBeNull();
    const items = assetsList?.querySelectorAll("li") ?? [];
    const texts = Array.from(items).map((el) => el.textContent);
    expect(texts.some((t) => t?.includes("ETH"))).toBe(true);
    expect(texts.some((t) => t?.includes("cbBTC"))).toBe(true);
    expect(texts.some((t) => t?.includes("SOL"))).toBe(true);
    expect(texts.some((t) => t?.includes("TSLAx"))).toBe(true);
  });

  it("renders the HowItWorks narrative section", () => {
    render(<LandingPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /how it works/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /pick your price/i }),
    ).toBeInTheDocument();
  });

  it("retitles the Mechanism section to 'Try it with live prices.'", () => {
    render(<LandingPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /try it with live prices/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: /here's how it works/i }),
    ).not.toBeInTheDocument();
  });

  it("exposes all four assets in the Mechanism toggle", () => {
    render(<LandingPage />);
    // The AssetToggle buttons live inside the Mechanism section. ETH and SOL
    // labels also appear in the AssetsStrip, so we scope to button role.
    expect(screen.getByRole("button", { name: "ETH" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "cbBTC" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SOL" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "TSLAx" })).toBeInTheDocument();
  });

  it("switches the Mechanism asset when a different toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<LandingPage />);

    const btcButton = screen.getByRole("button", { name: "cbBTC" });
    await user.click(btcButton);

    // After selecting cbBTC the spot line should reference cbBTC
    expect(screen.getByText(/cbbtc is/i)).toBeInTheDocument();
  });
});
