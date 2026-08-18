import { afterEach, describe, expect, it, vi } from "vitest";
import {
  invalidateData,
  subscribeDataInvalidation,
} from "@/lib/dataInvalidation";

const unsubscribe: Array<() => void> = [];

afterEach(() => {
  while (unsubscribe.length > 0) unsubscribe.pop()?.();
});

describe("data invalidation compatibility", () => {
  it("supports direct legacy refreshes without duplicating typed invalidations", () => {
    const positions = vi.fn();
    const activity = vi.fn();
    const yieldRefresh = vi.fn();
    unsubscribe.push(
      subscribeDataInvalidation("positions", positions),
      subscribeDataInvalidation("activity", activity),
      subscribeDataInvalidation("yield", yieldRefresh),
    );

    invalidateData(
      ["balances", "positions", "activity", "yield"],
      "trade-confirmed",
    );
    expect(positions).toHaveBeenCalledTimes(1);
    expect(activity).toHaveBeenCalledTimes(1);
    expect(yieldRefresh).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("balance:refetch"));
    expect(positions).toHaveBeenCalledTimes(2);
    expect(activity).toHaveBeenCalledTimes(2);
    expect(yieldRefresh).toHaveBeenCalledTimes(2);
    expect(positions).toHaveBeenLastCalledWith("legacy-balance-refetch");
  });
});
