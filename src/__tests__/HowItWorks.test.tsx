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

  it("renders all four step titles", () => {
    render(<HowItWorks />);
    expect(
      screen.getByRole("heading", { level: 3, name: /pick your conditions/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /commit collateral/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /get paid upfront/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /expiry resolves/i }),
    ).toBeInTheDocument();
  });

  it("step 1 lists amount, asset, strike, and expiry", () => {
    render(<HowItWorks />);
    const step1 = screen
      .getByRole("heading", { level: 3, name: /pick your conditions/i })
      .closest("article");
    expect(step1).not.toBeNull();
    expect(step1).toHaveTextContent(/amount/i);
    expect(step1).toHaveTextContent(/asset/i);
    expect(step1).toHaveTextContent(/strike/i);
    expect(step1).toHaveTextContent(/expiry/i);
    expect(step1).toHaveTextContent(/tslax/i);
    expect(step1).toHaveTextContent(/\$320/);
    expect(step1).toHaveTextContent(/7d/i);
  });

  it("step 2 mentions the collateral is locked and generating yield", () => {
    render(<HowItWorks />);
    const step2 = screen
      .getByRole("heading", { level: 3, name: /commit collateral/i })
      .closest("article");
    expect(step2).not.toBeNull();
    expect(step2).toHaveTextContent(/\$320 usdc/i);
    expect(step2).toHaveTextContent(/yield/i);
    expect(step2).toHaveTextContent(/expiry/i);
  });

  it("step 3 shows the upfront premium on the buy side", () => {
    render(<HowItWorks />);
    const step3 = screen
      .getByRole("heading", { level: 3, name: /get paid upfront/i })
      .closest("article");
    expect(step3).toHaveTextContent(/\+\$49/);
  });

  it("step 4 renders both outcome cases on the buy side", () => {
    render(<HowItWorks />);
    expect(screen.getByText(/tslax closes ≤ \$320/i)).toBeInTheDocument();
    expect(screen.getByText(/tslax closes > \$320/i)).toBeInTheDocument();
    expect(screen.getByText(/effective cost: \$271\/share/i)).toBeInTheDocument();
    expect(screen.getByText(/\+\$49 earned, no trade/i)).toBeInTheDocument();
  });

  it("switches to sell-side example when the toggle flips", async () => {
    const user = userEvent.setup();
    render(<HowItWorks />);

    const sellTab = screen.getByRole("button", { name: /i have the asset/i });
    await user.click(sellTab);

    const step1 = screen
      .getByRole("heading", { level: 3, name: /pick your conditions/i })
      .closest("article");
    expect(step1).toHaveTextContent(/\$380/);

    const step2 = screen
      .getByRole("heading", { level: 3, name: /commit collateral/i })
      .closest("article");
    expect(step2).toHaveTextContent(/1 tslax/i);
    expect(step2).toHaveTextContent(/yield/i);

    const step3 = screen
      .getByRole("heading", { level: 3, name: /get paid upfront/i })
      .closest("article");
    expect(step3).toHaveTextContent(/\+\$37/);

    expect(screen.getByText(/tslax closes ≥ \$380/i)).toBeInTheDocument();
    expect(screen.getByText(/tslax closes < \$380/i)).toBeInTheDocument();
    expect(screen.getByText(/effective price: \$417\/share/i)).toBeInTheDocument();
  });

  it("defaults the toggle to the USD side", () => {
    render(<HowItWorks />);
    const usdTab = screen.getByRole("button", { name: /i have usd/i });
    const assetTab = screen.getByRole("button", { name: /i have the asset/i });
    expect(usdTab).toHaveAttribute("aria-pressed", "true");
    expect(assetTab).toHaveAttribute("aria-pressed", "false");
  });
});
