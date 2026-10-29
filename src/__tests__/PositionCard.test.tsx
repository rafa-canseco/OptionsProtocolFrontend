import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Position } from "@/lib/api";

vi.mock("@/lib/contracts", () => ({
  CHAIN: { blockExplorers: { default: { url: "https://example.test" } } },
}));

import { PositionCard } from "@/components/PositionCard";
import { RangePositionCard } from "@/components/RangePositionCard";

afterEach(() => vi.useRealTimers());

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

describe("PositionCard optimistic expiry", () => {
  it("does not show quote TTL as maturity or derive APR before reconciliation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T03:00:00.000Z"));
    render(
      <PositionCard
        position={optimisticPosition}
        optimistic
        assetSymbol="cbZEC"
        assetSlug="cbzec"
      />,
    );

    expect(screen.getByText("Expiry pending reconciliation")).toBeInTheDocument();
    expect(screen.queryByText(/Settlement in/)).not.toBeInTheDocument();
    expect(screen.getByText("APR pending")).toBeInTheDocument();
    expect(screen.queryByText(/Expires /)).not.toBeInTheDocument();
    expect(screen.queryByText(/Add to calendar/)).not.toBeInTheDocument();
  });

  it("keeps range maturity and APR pending until reconciliation", () => {
    render(
      <RangePositionCard
        positions={[optimisticPosition, { ...optimisticPosition, id: "opt-call", is_put: false }]}
        optimistic
        assetSymbol="cbZEC"
        assetSlug="cbzec"
      />,
    );

    expect(screen.getByText("Expiry pending reconciliation")).toBeInTheDocument();
    expect(screen.getByText("APR pending")).toBeInTheDocument();
    expect(screen.queryByText(/Expires /)).not.toBeInTheDocument();
    expect(screen.queryByText(/Add to calendar/)).not.toBeInTheDocument();
  });
});
