import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VaultsPage } from "@/components/vaults/VaultsPage";
import { VAULT_STATE_COPY } from "@/lib/vaults";

vi.mock("@/components/ConnectButton", () => ({
  ConnectButton: () => <button type="button">Connect</button>,
}));

describe("VaultsPage", () => {
  it("renders the three strategy cards with concise descriptions", () => {
    render(<VaultsPage />);

    expect(screen.getByRole("heading", { name: "USDC CSP" })).toBeInTheDocument();
    expect(screen.getByText("Earn premium by selling ETH puts.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "WETH Covered Call" })).toBeInTheDocument();
    expect(screen.getByText("Earn premium on your WETH.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The Wheel" })).toBeInTheDocument();
    expect(
      screen.getByText("Cycle between USDC puts and WETH calls."),
    ).toBeInTheDocument();
  });

  it("routes manual trading directly to the ETH v2 interface", () => {
    render(<VaultsPage />);

    expect(screen.getByRole("link", { name: "Manual trading" })).toHaveAttribute(
      "href",
      "/earn/eth",
    );
    expect(screen.getByRole("link", { name: /looking for manual trading/i })).toHaveAttribute(
      "href",
      "/earn/eth",
    );
  });

  it("keeps strategy details outside the gallery and collapsed in the dialog", async () => {
    const user = userEvent.setup();
    render(<VaultsPage />);

    expect(screen.queryByText(/This vault uses your USDC as collateral/i)).not.toBeInTheDocument();

    const usdcCard = screen.getByRole("heading", { name: "USDC CSP" }).closest("article");
    expect(usdcCard).not.toBeNull();
    await user.click(within(usdcCard!).getByRole("button", { name: "Start earning" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View strategy details" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText(/This vault uses your USDC as collateral/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Sell ETH puts")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View strategy details" }));
    expect(screen.getByText(/This vault uses your USDC as collateral/i)).toBeInTheDocument();
    expect(screen.getByText("Sell ETH puts")).toBeInTheDocument();
    expect(screen.getByText("Market checks the strike.")).toBeInTheDocument();
    expect(screen.getByText(/If ETH stays above the strike/i)).toBeInTheDocument();
  });

  it("supports deposit and withdraw modes while keeping unavailable strategies disabled", async () => {
    const user = userEvent.setup();
    render(<VaultsPage />);

    const wethCard = screen.getByRole("heading", { name: "WETH Covered Call" }).closest("article");
    expect(wethCard).not.toBeNull();
    expect(within(wethCard!).getByRole("button", { name: "Coming soon" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Coming soon" })).toHaveLength(2);

    const usdcCard = screen.getByRole("heading", { name: "USDC CSP" }).closest("article");
    await user.click(within(usdcCard!).getByRole("button", { name: "Start earning" }));

    const depositTab = screen.getByRole("tab", { name: "deposit" });
    const withdrawTab = screen.getByRole("tab", { name: "withdraw" });
    expect(depositTab).toHaveAttribute("aria-selected", "true");

    await user.click(withdrawTab);
    expect(withdrawTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Request withdrawal" })).toBeDisabled();
  });
});

describe("vault position state presentation", () => {
  it("defines a single action for every Hito 1 user state", () => {
    expect(Object.keys(VAULT_STATE_COPY)).toEqual([
      "empty",
      "pending",
      "active",
      "exiting",
      "claimable-usdc",
      "claimable-weth",
    ]);
    expect(VAULT_STATE_COPY["claimable-usdc"].action).toBe("Claim USDC");
    expect(VAULT_STATE_COPY["claimable-weth"].action).toBe("Claim WETH");
  });
});
