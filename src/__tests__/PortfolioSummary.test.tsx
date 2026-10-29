import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Position } from "@/lib/api";
import { PortfolioSummary } from "@/components/PortfolioSummary";

vi.mock("@/lib/preferences", () => ({ useAppPreferences: () => ({ locale: "en" }) }));
vi.mock("@/components/YieldToggle", () => ({ YieldToggle: () => null }));

const optimisticPosition: Position = {
  id: "opt-new-position",
  tx_hash: "",
  block_number: 0,
  user_address: "0x0000000000000000000000000000000000000001",
  otoken_address: "0x0000000000000000000000000000000000000002",
  amount: 1e8,
  premium: "30000",
  collateral: 12e6,
  vault_id: 0,
  strike_price: 1_150e8,
  expiry: 0,
  is_put: true,
  is_settled: false,
  settled_at: null,
  settlement_tx_hash: null,
  indexed_at: "2026-10-29T03:00:00.000Z",
  settlement_type: null,
  delivered_asset: null,
  delivered_amount: null,
  delivery_tx_hash: null,
  is_itm: null,
  expiry_price: null,
  gross_premium: "30000",
  net_premium: "30000",
  protocol_fee: "0",
  outcome: null,
  asset: "cbzec",
  group_id: null,
};

describe("PortfolioSummary pending data", () => {
  it("does not invent zero traded volume or APR for unverified data", () => {
    render(
      <PortfolioSummary
        positions={[optimisticPosition]}
        activity={null}
        yieldMetric="apr"
        onYieldMetricChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Total Traded").parentElement).toHaveTextContent("—");
    expect(screen.getByText("Avg").parentElement?.parentElement).toHaveTextContent("—");
  });
});
