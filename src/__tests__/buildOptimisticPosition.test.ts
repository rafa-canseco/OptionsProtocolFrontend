import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import type { PriceQuote } from "@/lib/api";

vi.mock("@/lib/contracts", () => ({
  publicClient: {},
  ADDRESSES: { usdc: "0x0000000000000000000000000000000000000001", weth: "0x0000000000000000000000000000000000000002", wbtc: "0x0000000000000000000000000000000000000003" },
  ERC20_ABI: [],
  BATCH_SETTLER_ABI: [],
}));

import { buildOptimisticPosition } from "@/lib/execution";

const quote: PriceQuote = {
  option_type: "put",
  strike: 1_150,
  expiry_days: 1,
  expiry_date: "2026-10-29",
  premium: 0.03,
  delta: 0.2,
  iv: 0.5,
  spot: 1_235,
  ttl: 240,
  expires_at: 1_793_245_440,
  available_amount: 1,
  otoken_address: "0x0000000000000000000000000000000000000003",
  signature: null,
  mm_address: null,
  bid_price_raw: null,
  deadline: null,
  quote_id: null,
  max_amount_raw: null,
  maker_nonce: null,
  position_count: 0,
  chain: "base",
};

describe("buildOptimisticPosition", () => {
  it("does not confuse quote expiry with option maturity", () => {
    const position = buildOptimisticPosition(
      quote,
      12,
      true,
      "0x0000000000000000000000000000000000000001" as Address,
      "cbzec",
    );

    expect(quote.expires_at).toBeGreaterThan(0);
    expect(position.expiry).toBe(0);
  });
});
