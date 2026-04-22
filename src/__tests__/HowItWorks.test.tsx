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
    expect(screen.getByText(/walk through a concrete example/i)).toBeInTheDocument();
  });

  it("renders all four step titles", () => {
    render(<HowItWorks />);
    expect(screen.getByRole("heading", { level: 3, name: /pick your price/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /commit your collateral/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /get paid the premium upfront/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /wait for expiry/i }),
    ).toBeInTheDocument();
  });

  it("shows the buy-side TSLAx example by default", () => {
    render(<HowItWorks />);
    expect(screen.getByText(/i'll buy 1 tslax at \$320/i)).toBeInTheDocument();
    const locked = screen.getByText(/locked:/i);
    expect(locked.parentElement).toHaveTextContent("$320 USDC");
    const received = screen.getByText(/you receive:/i);
    expect(received.parentElement).toHaveTextContent(/\+\$49/);
  });

  it("renders buy-side outcome grid with both cases", () => {
    render(<HowItWorks />);
    expect(screen.getByText(/tslax closes ≤ \$320/i)).toBeInTheDocument();
    expect(screen.getByText(/tslax closes > \$320/i)).toBeInTheDocument();
    expect(screen.getByText(/effective cost: \$271\/share/i)).toBeInTheDocument();
    expect(screen.getByText(/net: \+\$49 earned, no trade/i)).toBeInTheDocument();
  });

  it("switches to sell-side example when the toggle flips", async () => {
    const user = userEvent.setup();
    render(<HowItWorks />);

    const sellTab = screen.getByRole("button", { name: /i have the asset/i });
    await user.click(sellTab);

    expect(screen.getByText(/i'll sell 1 tslax at \$380/i)).toBeInTheDocument();
    const locked = screen.getByText(/locked:/i);
    expect(locked.parentElement).toHaveTextContent("1 TSLAx");
    const received = screen.getByText(/you receive:/i);
    expect(received.parentElement).toHaveTextContent(/\+\$37/);
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
