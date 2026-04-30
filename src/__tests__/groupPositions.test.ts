import { describe, expect, it } from "vitest";
import { groupPositions } from "@/lib/positionGrouping";
import type { Position } from "@/lib/api";

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

describe("groupPositions", () => {
  it("groups two positions sharing a group_id (one put + one call) into a single range item", () => {
    const put = buildPosition({ id: "p1", is_put: true, group_id: "g1" });
    const call = buildPosition({ id: "c1", is_put: false, group_id: "g1" });

    const items = groupPositions([put, call]);

    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("range");
    if (items[0].type === "range") {
      expect(items[0].groupId).toBe("g1");
      expect(items[0].positions).toHaveLength(2);
    }
  });

  it("does NOT pair ungrouped put + call legs even when same expiry, asset, and indexed seconds apart (regression for false-Range bug)", () => {
    const put = buildPosition({
      id: "p1",
      is_put: true,
      group_id: null,
      indexed_at: "2026-04-30T12:00:00Z",
    });
    const call = buildPosition({
      id: "c1",
      is_put: false,
      group_id: null,
      indexed_at: "2026-04-30T12:00:10Z",
    });

    const items = groupPositions([put, call]);

    expect(items).toHaveLength(2);
    expect(items.every((i) => i.type === "single")).toBe(true);
  });

  it("renders a group_id with both legs of the same side as separate single items", () => {
    const put1 = buildPosition({ id: "p1", is_put: true, group_id: "g1" });
    const put2 = buildPosition({ id: "p2", is_put: true, group_id: "g1" });

    const items = groupPositions([put1, put2]);

    expect(items).toHaveLength(2);
    expect(items.every((i) => i.type === "single")).toBe(true);
  });

  it("handles a mix of grouped and ungrouped positions", () => {
    const grouped_put = buildPosition({ id: "p1", is_put: true, group_id: "g1" });
    const grouped_call = buildPosition({ id: "c1", is_put: false, group_id: "g1" });
    const lone_put = buildPosition({
      id: "p2",
      is_put: true,
      group_id: null,
      indexed_at: "2026-04-30T11:00:00Z",
    });
    const lone_call = buildPosition({
      id: "c2",
      is_put: false,
      group_id: null,
      indexed_at: "2026-04-30T11:00:05Z",
    });

    const items = groupPositions([grouped_put, grouped_call, lone_put, lone_call]);

    expect(items).toHaveLength(3);
    expect(items.filter((i) => i.type === "range")).toHaveLength(1);
    expect(items.filter((i) => i.type === "single")).toHaveLength(2);
  });

  it("returns an empty array for empty input", () => {
    expect(groupPositions([])).toEqual([]);
  });

  it("sorts items by most recent indexed_at descending", () => {
    const old = buildPosition({ id: "old", indexed_at: "2026-04-29T00:00:00Z" });
    const recent = buildPosition({ id: "recent", indexed_at: "2026-04-30T12:00:00Z" });
    const middle = buildPosition({ id: "middle", indexed_at: "2026-04-30T06:00:00Z" });

    const items = groupPositions([old, recent, middle]);
    const ids = items.map((i) => (i.type === "single" ? i.position.id : ""));

    expect(ids).toEqual(["recent", "middle", "old"]);
  });
});
