import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Position } from "@/lib/api";
import {
  getAllOptimistic,
  removeMatchingOptimistic,
  saveOptimistic,
} from "@/lib/optimisticPositions";

function buildPosition(overrides: Partial<Position> = {}): Position {
  return {
    id: "pos-1",
    tx_hash: "0xtx",
    block_number: 1,
    user_address: "0xuser",
    otoken_address: "0xot",
    amount: 1,
    premium: "0",
    collateral: 0,
    vault_id: 1,
    strike_price: 2_250,
    expiry: 1_900_000_000,
    is_put: true,
    is_settled: false,
    settled_at: null,
    settlement_tx_hash: null,
    indexed_at: "2026-04-30T12:00:00Z",
    settlement_type: null,
    delivered_asset: null,
    delivered_amount: null,
    delivery_tx_hash: null,
    is_itm: null,
    expiry_price: null,
    gross_premium: "0",
    net_premium: "0",
    protocol_fee: "0",
    outcome: null,
    asset: "eth",
    group_id: null,
    ...overrides,
  };
}

describe("removeMatchingOptimistic", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("removes matching optimistic when real has matching group_id", () => {
    const opt = buildPosition({ id: "opt-1", group_id: "g1" });
    saveOptimistic(opt);

    const real = buildPosition({ id: "real-1", group_id: "g1" });
    removeMatchingOptimistic([real]);

    expect(getAllOptimistic()).toHaveLength(0);
  });

  it("removes matching optimistic when neither has group_id", () => {
    const opt = buildPosition({ id: "opt-1", group_id: null });
    saveOptimistic(opt);

    const real = buildPosition({ id: "real-1", group_id: null });
    removeMatchingOptimistic([real]);

    expect(getAllOptimistic()).toHaveLength(0);
  });

  it("KEEPS optimistic alive while real exists but lacks group_id (regression for Range flicker)", () => {
    const opt = buildPosition({ id: "opt-1", group_id: "g1" });
    saveOptimistic(opt);

    const real = buildPosition({ id: "real-1", group_id: null });
    removeMatchingOptimistic([real]);

    expect(getAllOptimistic()).toHaveLength(1);
    expect(getAllOptimistic()[0].group_id).toBe("g1");
  });

  it("keeps optimistic that has no real match", () => {
    const opt = buildPosition({
      id: "opt-1",
      otoken_address: "0xother",
    });
    saveOptimistic(opt);

    const real = buildPosition({ id: "real-1", otoken_address: "0xdifferent" });
    removeMatchingOptimistic([real]);

    expect(getAllOptimistic()).toHaveLength(1);
  });

  it("drops legacy optimistic positions that do not include an asset", () => {
    const opt = buildPosition({ id: "opt-legacy", asset: undefined });
    saveOptimistic(opt);

    expect(getAllOptimistic()).toHaveLength(0);
  });
});
