import { describe, expect, it } from "vitest";
import type { Position } from "@/lib/api";
import { getPositionPremiumUsd } from "@/lib/positionMath";

const BASE: Position = {
  id: "1",
  tx_hash: "0xabc",
  block_number: 1,
  user_address: "0xuser",
  otoken_address: "0xtoken",
  amount: 25_00000000,
  premium: "30000",
  collateral: 25_00000000,
  vault_id: 1,
  strike_price: 88_00000000,
  expiry: 1776556800,
  is_put: false,
  is_settled: false,
  settled_at: null,
  settlement_tx_hash: null,
  indexed_at: "2026-01-01T00:00:00Z",
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
};

describe("getPositionPremiumUsd", () => {
  it("normalizes raw micro-USDC premiums", () => {
    expect(getPositionPremiumUsd(BASE)).toBe(0.03);
  });

  it("keeps already-humanized premium strings", () => {
    expect(getPositionPremiumUsd({ ...BASE, net_premium: "0.03" })).toBe(0.03);
  });
});
