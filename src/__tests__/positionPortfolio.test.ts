import { describe, expect, it } from "vitest";
import type { Position, PositionPortfolioPagination } from "@/lib/api";
import {
  createPositionPortfolioState,
  mergePosition,
  positionPortfolioReducer,
  selectActivePositions,
  selectPositions,
  selectSettledPositions,
} from "@/lib/positionPortfolio";

function row(
  id: string,
  options: Partial<Position> = {},
): Position {
  return {
    id,
    indexed_at: "2026-08-03T10:00:00Z",
    updated_at: "2026-08-03T10:00:00Z",
    is_settled: false,
    ...options,
  } as Position;
}

const pagination: PositionPortfolioPagination = {
  bounded: true,
  watermark: "2026-08-03T10:10:00Z",
  active: { limit: 50, has_more: true, next_cursor: "active-cursor" },
  settled: { limit: 20, has_more: true, next_cursor: "settled-cursor" },
};

describe("position portfolio reducer", () => {
  it("rejects an older revision and never reverses settlement", () => {
    const settled = row("one", {
      updated_at: "2026-08-03T10:02:00Z",
      is_settled: true,
      settlement_type: "cash",
    });
    expect(
      mergePosition(
        settled,
        row("one", { updated_at: "2026-08-03T10:01:00Z" }),
      ),
    ).toBe(settled);
    expect(
      mergePosition(
        settled,
        row("one", { updated_at: "2026-08-03T10:03:00Z" }),
      ),
    ).toBe(settled);
  });

  it("moves an entity atomically from active to settled on an equal revision", () => {
    let state = createPositionPortfolioState("source");
    state = positionPortfolioReducer(state, {
      type: "bounded_snapshot",
      sourceKey: "source",
      positions: [row("one")],
      pagination,
      route: "wallet_direct",
    });
    state = positionPortfolioReducer(state, {
      type: "changes_page",
      sourceKey: "source",
      positions: [row("one", { is_settled: true, settled_at: "2026-08-03T10:00:00Z" })],
    });

    expect(selectActivePositions(state)).toEqual([]);
    expect(selectSettledPositions(state).map((position) => position.id)).toEqual([
      "one",
    ]);
    expect(selectPositions(state)).toHaveLength(1);
  });

  it("deduplicates tied timestamps by ID with stable deterministic order", () => {
    let state = createPositionPortfolioState("source");
    state = positionPortfolioReducer(state, {
      type: "bounded_snapshot",
      sourceKey: "source",
      positions: [row("a"), row("b"), row("a", { premium: "2" })],
      pagination,
      route: "wallet_batch",
    });

    expect(selectPositions(state).map((position) => position.id)).toEqual(["b", "a"]);
    expect(selectPositions(state).find((position) => position.id === "a")?.premium).toBe("2");
  });

  it("keeps traversal cursors and watermark stable during delta replay", () => {
    let state = createPositionPortfolioState("source");
    state = positionPortfolioReducer(state, {
      type: "bounded_snapshot",
      sourceKey: "source",
      positions: [row("one")],
      pagination,
      route: "account",
    });
    state = positionPortfolioReducer(state, {
      type: "changes_page",
      sourceKey: "source",
      positions: [row("two"), row("two")],
    });
    state = positionPortfolioReducer(state, {
      type: "changes_page",
      sourceKey: "source",
      positions: [row("two"), row("three")],
    });

    expect(state.watermark).toBe(pagination.watermark);
    expect(state.active.cursor).toBe("active-cursor");
    expect(state.settled.cursor).toBe("settled-cursor");
    expect(selectPositions(state)).toHaveLength(3);

    state = positionPortfolioReducer(state, {
      type: "changes_complete",
      sourceKey: "source",
      watermark: "2026-08-03T10:20:00Z",
    });
    expect(state.watermark).toBe("2026-08-03T10:20:00Z");
  });

  it("replaces legacy whole snapshots without retaining missing rows", () => {
    let state = createPositionPortfolioState("source");
    state = positionPortfolioReducer(state, {
      type: "legacy_snapshot",
      sourceKey: "source",
      positions: [row("old")],
      route: "wallet_direct",
    });
    state = positionPortfolioReducer(state, {
      type: "legacy_snapshot",
      sourceKey: "source",
      positions: [row("new")],
      route: "wallet_direct",
    });

    expect(state.mode).toBe("legacy");
    expect(selectPositions(state).map((position) => position.id)).toEqual(["new"]);
  });
});
