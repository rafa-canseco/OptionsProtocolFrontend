import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";

afterEach(() => vi.useRealTimers());

describe("ExpiryCountdown", () => {
  it("does not label an unindexed optimistic row expired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T23:00:00.000Z"));
    const { container } = render(
      <ExpiryCountdown
        expiryTimestamp={Date.parse("2026-10-10T08:00:00.000Z") / 1000}
        pending
      />,
    );

    expect(container.textContent).toBe("Expiry pending reconciliation");
  });

  it("shows expired for an indexed position past maturity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T23:00:00.000Z"));
    const { container } = render(
      <ExpiryCountdown
        expiryTimestamp={Date.parse("2026-10-10T08:00:00.000Z") / 1000}
      />,
    );

    expect(container.textContent).toBe("Expired");
  });
});
