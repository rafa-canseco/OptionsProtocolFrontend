import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectButton } from "@/components/ConnectButton";

const mockWallet = { isConnected: true, isReady: true };
const mockLogin = vi.fn();

vi.mock("@/hooks/useWalletSummary", () => ({ useWalletSummary: () => mockWallet }));
vi.mock("@/lib/preferences", () => ({ useAppPreferences: () => ({ locale: "en" }) }));
vi.mock("@privy-io/react-auth", () => ({ useLogin: () => ({ login: mockLogin }) }));
vi.mock("@/components/DepositModal", () => ({ DepositModal: () => <div data-testid="deposit-modal" /> }));

describe("ConnectButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWallet.isConnected = true;
    mockWallet.isReady = true;
  });

  it("starts authentication without opening Deposit when disconnected", async () => {
    mockWallet.isConnected = false;
    render(<ConnectButton />);
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(mockLogin).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("deposit-modal")).not.toBeInTheDocument();
  });

  it("opens Deposit only when the connected user requests it", async () => {
    render(<ConnectButton />);
    await userEvent.click(screen.getByRole("button", { name: "Deposit" }));
    expect(screen.getByTestId("deposit-modal")).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("shows a loading skeleton before wallet state is ready", () => {
    mockWallet.isReady = false;
    render(<ConnectButton />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
