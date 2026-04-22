import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HowItWorks } from "@/components/landing/HowItWorks";

describe("HowItWorks", () => {
  it("renders the section heading and subheading", () => {
    render(<HowItWorks />);
    expect(
      screen.getByRole("heading", { level: 2, name: /how it works/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 tslax @ \$320, 7-day/i)).toBeInTheDocument();
  });

  it("renders the three step titles (commit and premium merged)", () => {
    render(<HowItWorks />);
    expect(
      screen.getByRole("heading", { level: 3, name: /pick your conditions/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /commit & get paid/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /expiry resolves/i }),
    ).toBeInTheDocument();
  });

  it("step 1 shows Asset, Strike (with description), Amount to commit, and Expiry on buy side", () => {
    render(<HowItWorks />);
    const step1 = screen
      .getByRole("heading", { level: 3, name: /pick your conditions/i })
      .closest("article");
    expect(step1).not.toBeNull();
    expect(step1).toHaveTextContent(/asset/i);
    expect(step1).toHaveTextContent(/tslax/i);
    expect(step1).toHaveTextContent(/strike/i);
    expect(step1).toHaveTextContent(/\$320/);
    expect(step1).toHaveTextContent(/price you'd buy at/i);
    expect(step1).toHaveTextContent(/amount to commit/i);
    expect(step1).toHaveTextContent(/\$320 usdc/i);
    expect(step1).toHaveTextContent(/expiry/i);
    expect(step1).toHaveTextContent(/7d/i);
  });

  it("step 2 shows locked collateral with explicit expiry, premium upfront, and yield", () => {
    render(<HowItWorks />);
    const step2 = screen
      .getByRole("heading", { level: 3, name: /commit & get paid/i })
      .closest("article");
    expect(step2).not.toBeNull();
    expect(step2).toHaveTextContent(/locked/i);
    expect(step2).toHaveTextContent(/\$320 usdc/i);
    expect(step2).toHaveTextContent(/7d/i);
    expect(step2).toHaveTextContent(/premium/i);
    expect(step2).toHaveTextContent(/\+\$49/);
    expect(step2).toHaveTextContent(/yield/i);
  });

  it("step 3 shows buy-side outcomes with explicit USD totals", () => {
    render(<HowItWorks />);
    const step3 = screen
      .getByRole("heading", { level: 3, name: /expiry resolves/i })
      .closest("article");
    expect(step3).not.toBeNull();
    expect(step3).toHaveTextContent(/tslax drops to \$320 or below/i);
    expect(step3).toHaveTextContent(/tslax stays above \$320/i);
    expect(step3).toHaveTextContent(/your buy triggers/i);
    expect(step3).toHaveTextContent(/1 tslax at \$320/i);
    expect(step3).toHaveTextContent(/effective cost: \$271\/share/i);
    expect(step3).toHaveTextContent(/no trade/i);
    expect(step3).toHaveTextContent(/\$320 usdc back/i);
    expect(step3).toHaveTextContent(/total: \$369 usdc/i);
  });

  it("renders buy-side outcomes with price-up scenario before price-down", () => {
    render(<HowItWorks />);
    const stayAbove = screen.getByText(/tslax stays above \$320/i);
    const dropBelow = screen.getByText(/tslax drops to \$320 or below/i);
    const pos = stayAbove.compareDocumentPosition(dropBelow);
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("switches to sell-side example with explicit USD totals when the toggle flips", async () => {
    const user = userEvent.setup();
    render(<HowItWorks />);
    await user.click(screen.getByRole("button", { name: /i have the asset/i }));

    const step1 = screen
      .getByRole("heading", { level: 3, name: /pick your conditions/i })
      .closest("article");
    expect(step1).toHaveTextContent(/\$380/);
    expect(step1).toHaveTextContent(/price you'd sell at/i);
    expect(step1).toHaveTextContent(/1 tslax/i);

    const step2 = screen
      .getByRole("heading", { level: 3, name: /commit & get paid/i })
      .closest("article");
    expect(step2).toHaveTextContent(/1 tslax/i);
    expect(step2).toHaveTextContent(/7d/i);
    expect(step2).toHaveTextContent(/\+\$37/);
    expect(step2).toHaveTextContent(/yield/i);

    const step3 = screen
      .getByRole("heading", { level: 3, name: /expiry resolves/i })
      .closest("article");
    expect(step3).toHaveTextContent(/tslax rises to \$380 or above/i);
    expect(step3).toHaveTextContent(/tslax stays below \$380/i);
    expect(step3).toHaveTextContent(/your sell triggers/i);
    expect(step3).toHaveTextContent(/1 tslax at \$380/i);
    expect(step3).toHaveTextContent(/total: \$417 usdc/i);
    expect(step3).toHaveTextContent(/no trade/i);
    expect(step3).toHaveTextContent(/1 tslax back/i);
    expect(step3).toHaveTextContent(/\+\$37/);

    const riseAbove = screen.getByText(/tslax rises to \$380 or above/i);
    const stayBelow = screen.getByText(/tslax stays below \$380/i);
    const pos = riseAbove.compareDocumentPosition(stayBelow);
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("defaults the toggle to the USD side", () => {
    render(<HowItWorks />);
    const usdTab = screen.getByRole("button", { name: /i have usd/i });
    const assetTab = screen.getByRole("button", { name: /i have the asset/i });
    expect(usdTab).toHaveAttribute("aria-pressed", "true");
    expect(assetTab).toHaveAttribute("aria-pressed", "false");
  });
});
