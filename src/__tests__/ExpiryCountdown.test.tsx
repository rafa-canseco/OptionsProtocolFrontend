import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";

afterEach(() => vi.useRealTimers());

describe("ExpiryCountdown", () => {
  const expiryTimestamp = Date.parse("2026-10-20T08:00:00.000Z") / 1000;

  it("shows the time remaining until settlement before maturity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T07:30:00.000Z"));
    const { container } = render(<ExpiryCountdown expiryTimestamp={expiryTimestamp} />);

    expect(container.textContent).toBe("Settlement in 0h 30m");
  });

  it("rounds up a partial minute while settlement time remains", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T07:59:30.000Z"));
    const { container } = render(<ExpiryCountdown expiryTimestamp={expiryTimestamp} />);

    expect(container.textContent).toBe("Settlement in 0h 1m");
  });

  it("says expired at the exact maturity timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T08:00:00.000Z"));
    const { container } = render(<ExpiryCountdown expiryTimestamp={expiryTimestamp} />);

    expect(container.textContent).toBe("Expired");
  });

  it("says expired after maturity even if settlement has not completed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T09:00:00.000Z"));
    const { container } = render(<ExpiryCountdown expiryTimestamp={expiryTimestamp} />);

    expect(container.textContent).toBe("Expired");
  });

  it("preserves the expiry reconciliation label for optimistic positions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T09:00:00.000Z"));
    const { container } = render(
      <ExpiryCountdown expiryTimestamp={expiryTimestamp} pending />,
    );

    expect(container.textContent).toBe("Expiry pending reconciliation");
  });
});
