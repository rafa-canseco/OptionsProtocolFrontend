import { render, screen } from "@testing-library/react";
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
      screen.getByText("Earnings will appear after your first settled position"),
    ).toBeInTheDocument();
  });
});
