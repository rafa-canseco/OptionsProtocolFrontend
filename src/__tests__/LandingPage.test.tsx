import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingPage } from "@/components/landing/LandingPage";

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
      screen.getByRole("heading", { level: 3, name: /pick your conditions/i }),
    ).toBeInTheDocument();
  });

  it("removes the MechanismSection (no 'Try it with live prices' or 'Here\\'s how it works')", () => {
    render(<LandingPage />);
    expect(
      screen.queryByRole("heading", { level: 2, name: /try it with live prices/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: /here's how it works/i }),
    ).not.toBeInTheDocument();
  });

  it("places AssetsStrip immediately before HowItWorks", () => {
    const { container } = render(<LandingPage />);
    const assetsStripList = container.querySelector("ul");
    const howItWorksHeading = screen.getByRole("heading", {
      level: 2,
      name: /how it works/i,
    });
    expect(assetsStripList).not.toBeNull();
    expect(howItWorksHeading).toBeInTheDocument();
    if (assetsStripList) {
      const pos = assetsStripList.compareDocumentPosition(howItWorksHeading);
      // HowItWorks comes after the AssetsStrip list in document order
      expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    }
  });
});
