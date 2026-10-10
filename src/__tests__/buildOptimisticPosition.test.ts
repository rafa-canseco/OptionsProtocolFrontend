import { describe, expect, it, vi } from "vitest";
import type { PriceQuote } from "@/lib/api";

vi.mock("@/lib/contracts", () => ({
  publicClient: {},
  ADDRESSES: {
    weth: "0x0000000000000000000000000000000000000001",
    wbtc: "0x0000000000000000000000000000000000000002",
    usdc: "0x0000000000000000000000000000000000000003",
  },
  ERC20_ABI: [],
  BATCH_SETTLER_ABI: [],
}));
import { buildOptimisticPosition } from "@/lib/execution";
import { getPositionPremiumUsd } from "@/lib/positionMath";

const quote = (optionExpiry?: number): PriceQuote => ({
  option_type: "put",
  strike: 80,
  expiry_days: 2,
  expiry_date: "2026-10-12",
  option_expiry: optionExpiry,
  premium: 0.1,
  delta: 0.25,
  iv: 0.65,
  spot: 85,
  ttl: 240,
  expires_at: 1_791_657_779,
  available_amount: 0.2,
  otoken_address: "0x4081808CC806Eb8BaC26E3a7c0d7b7e6Cf4586AB",
  deployment_status: "ready",
  signature: "0x",
  mm_address: "0x0000000000000000000000000000000000000001",
  bid_price_raw: "100000",
  deadline: "1791657779",
  quote_id: "quote-1",
  max_amount_raw: "20000000",
  maker_nonce: "63",
  position_count: 0,
  chain: "base",
});

describe("buildOptimisticPosition", () => {
  it("stores calculated USDC premium as integer base units", () => {
    const position = buildOptimisticPosition(
      { ...quote(), premium: 105_934 },
      16.02,
      true,
      "0x0000000000000000000000000000000000000002",
      "cbhype",
    );

    expect(position.net_premium).toBe("21213");
    expect(getPositionPremiumUsd(position)).toBe(0.021213);
  });

  it("uses option maturity, not the short-lived quote deadline", () => {
    const position = buildOptimisticPosition(
      quote(1_791_792_000),
      16,
      true,
      "0x0000000000000000000000000000000000000002",
      "cbhype",
    );

    expect(position.expiry).toBe(1_791_792_000);
    expect(position.expiry).not.toBe(quote().expires_at);
  });

  it("derives the Base 08:00 UTC maturity from the ISO expiry date during rollout", () => {
    const position = buildOptimisticPosition(
      quote(undefined),
      16,
      true,
      "0x0000000000000000000000000000000000000002",
      "cbhype",
    );

    expect(position.expiry).toBe(1_791_792_000);
  });
});
