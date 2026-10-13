import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Position } from "@/lib/api";

vi.mock("@/lib/preferences", () => ({
  useAppPreferences: () => ({ locale: "en" }),
}));

import { EarningsChart } from "@/components/EarningsChart";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { getPositionPremiumUsd } from "@/lib/positionMath";

const optimisticPosition = {
  id: "opt-pending",
  indexed_at: "2026-08-03T10:00:00Z",
  expiry: 1_800_000_000,
  is_put: true,
  is_settled: false,
  collateral: 16_020_000,
  strike_price: 8_000_000_000,
  net_premium: "21213.000000000004",
} as Position;

describe("unindexed optimistic earnings", () => {
  it("normalizes raw premium strings from previously persisted optimistic rows", () => {
    expect(getPositionPremiumUsd(optimisticPosition)).toBeCloseTo(0.021213, 12);
  });

  it("does not include pending premium in earned or average yield totals", () => {
    render(
      <PortfolioSummary
        positions={[optimisticPosition]}
        activity={null}
        yieldMetric="apr"
        onYieldMetricChange={() => {}}
      />,
    );

    expect(screen.getByText("Total Earned").parentElement).toHaveTextContent("$0.00");
    expect(screen.getByText("0.0%")).toBeInTheDocument();
  });

  it("does not plot optimistic premiums", () => {
    render(<EarningsChart positions={[optimisticPosition]} />);

    expect(
      screen.getByText("Premiums appear after your first confirmed position"),
    ).toBeInTheDocument();
  });

  it("plots confirmed open and closed premiums and respects the selected period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    const positions = [
      {
        ...optimisticPosition,
        id: "closed",
        is_settled: true,
        indexed_at: "2026-04-01T10:00:00Z",
        net_premium: "1000000",
      },
      {
        ...optimisticPosition,
        id: "open",
        is_settled: false,
        indexed_at: "2026-04-02T10:00:00Z",
        block_timestamp: Date.parse("2026-04-03T10:00:00Z") / 1000,
        net_premium: "2000000",
      },
    ] as Position[];

    render(<EarningsChart positions={positions} />);
    expect(screen.getByText("Cumulative net premiums")).toBeInTheDocument();
    expect(document.querySelectorAll("svg circle")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "1M" }));
    expect(screen.getByText("No confirmed premiums in this period.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ALL" }));
    expect(document.querySelectorAll("svg circle")).toHaveLength(2);
    vi.useRealTimers();
  });

  it("resets selected-period cumulative premiums and hover totals", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    const positions = [
      {
        ...optimisticPosition,
        id: "outside-period",
        indexed_at: "2026-09-01T10:00:00Z",
        net_premium: "100000000",
      },
      {
        ...optimisticPosition,
        id: "inside-period",
        indexed_at: "2026-10-05T10:00:00Z",
        net_premium: "3000000",
      },
    ] as Position[];
    const { container } = render(<EarningsChart positions={positions} />);
    fireEvent.click(screen.getByRole("button", { name: "1M" }));

    const svg = container.querySelector("svg")!;
    Object.defineProperty(svg, "getScreenCTM", {
      value: () => ({ inverse: () => ({}) }),
    });
    Object.defineProperty(svg, "createSVGPoint", {
      value: () => ({
        matrixTransform: () => ({ x: 480 }),
      }),
    });
    fireEvent.mouseMove(svg, { clientX: 0, clientY: 0 });

    expect(container.textContent).toContain("+$3.00");
    vi.useRealTimers();
  });
});
