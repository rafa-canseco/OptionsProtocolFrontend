import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TradeLog } from "@/components/TradeLog";
import type { Position } from "@/lib/api";

vi.mock("@/lib/preferences", () => ({ useAppPreferences: () => ({ locale: "en" }) }));
vi.mock("@/lib/contracts", () => ({ CHAIN: { blockExplorers: { default: { url: "https://basescan.org" } } } }));
vi.mock("@/lib/solana", () => ({ solanaTxUrl: (hash: string) => `https://solscan.io/tx/${hash}` }));

const position: Position = {
  id: "eth-history-1",
  tx_hash: "0xopen",
  block_number: 1,
  user_address: "0xuser",
  otoken_address: "0xoption",
  amount: 100_000_000,
  premium: "1000000",
  collateral: 2_000_000_000,
  vault_id: 1,
  strike_price: 2000 * 1e8,
  strike_usd: 2000,
  expiry: 1_800_000_000,
  is_put: true,
  is_settled: true,
  settled_at: "2026-08-03T10:00:00Z",
  settlement_tx_hash: "0xsettled",
  indexed_at: "2026-08-01T10:00:00Z",
  settlement_type: "expired",
  delivered_asset: null,
  delivered_amount: null,
  delivery_tx_hash: null,
  is_itm: false,
  expiry_price: 2100 * 1e8,
  expiry_price_usd: 2100,
  gross_premium: "1000000",
  net_premium: "1000000",
  protocol_fee: "0",
  outcome: "expired",
  asset: "eth",
  group_id: null,
};

describe("TradeLog accessibility", () => {
  it("provides an intentional mobile scroll region and keyboard-expanded details", async () => {
    const user = userEvent.setup();
    render(<TradeLog items={[{ type: "single", position }]} />);

    const scrollRegion = screen.getByRole("region", { name: "Position history table. Scroll horizontally for more columns." });
    expect(scrollRegion).toHaveClass("overflow-x-auto");
    expect(scrollRegion).toHaveAttribute("tabindex", "0");

    const expand = screen.getByRole("button", { name: "Expand position details" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expand.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: "Collapse position details" })).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("history-details-eth-history-1")).toBeInTheDocument();
  });
});
