import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";

afterEach(() => vi.useRealTimers());

describe("ExpiryCountdown", () => {
  const expiryTimestamp = Date.parse("2026-10-20T08:00:00.000Z") / 1000;

  it("shows the countdown before maturity, even while settlement is pending", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T07:30:00.000Z"));
    const { container } = render(
      <ExpiryCountdown expiryTimestamp={expiryTimestamp} settlementPending />,
    );

    expect(container.textContent).toBe("0h 30m left");
  });

  it("says settlement pending after maturity until the position is settled", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T09:00:00.000Z"));
    const { container } = render(
      <ExpiryCountdown expiryTimestamp={expiryTimestamp} settlementPending />,
    );

    expect(container.textContent).toBe("Settlement pending");
  });

  it("preserves the expiry reconciliation label for optimistic positions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T09:00:00.000Z"));
    const { container } = render(
      <ExpiryCountdown expiryTimestamp={expiryTimestamp} pending />,
    );

    expect(container.textContent).toBe("Expiry pending reconciliation");
  });

  it("shows expired when no settlement is pending", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T09:00:00.000Z"));
    const { container } = render(<ExpiryCountdown expiryTimestamp={expiryTimestamp} />);

    expect(container.textContent).toBe("Expired");
  });
});
