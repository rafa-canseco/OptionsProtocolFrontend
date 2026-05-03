import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectButton } from "@/components/ConnectButton";

const mockWallet = {
  isConnected: true,
  isReady: true,
  connectWallet: vi.fn(),
};

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => mockWallet,
}));

vi.mock("@/components/DepositModal", () => ({
  DepositModal: () => <div data-testid="deposit-modal" />,
}));

describe("ConnectButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWallet.isConnected = true;
    mockWallet.isReady = true;
  });

  it("shows Connect when not connected", () => {
    mockWallet.isConnected = false;
    render(<ConnectButton />);
    expect(screen.getByText("Connect")).toBeInTheDocument();
  });

  it("shows loading skeleton when not ready", () => {
    mockWallet.isReady = false;
    render(<ConnectButton />);
    expect(screen.queryByText("Connect")).not.toBeInTheDocument();
    expect(screen.queryByText("Deposit")).not.toBeInTheDocument();
  });

  it("shows Deposit button when connected", () => {
    render(<ConnectButton />);
    expect(screen.getByText("Deposit")).toBeInTheDocument();
  });

  it("opens deposit modal when Deposit is clicked", async () => {
    render(<ConnectButton />);
    await userEvent.click(screen.getByText("Deposit"));
    expect(screen.getByTestId("deposit-modal")).toBeInTheDocument();
  });
});
