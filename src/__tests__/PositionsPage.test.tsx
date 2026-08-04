import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pageState = vi.hoisted(() => ({
  positions: [
    {
      id: "settled-1",
      indexed_at: "2026-08-03T10:00:00Z",
      is_settled: true,
      group_id: null,
    },
  ],
  loading: false,
  refresh: vi.fn(),
  loadMoreSettled: vi.fn().mockResolvedValue(undefined),
  settledHasMore: true,
  settledLoading: false,
  error: null,
}));

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({ user: { id: "privy-user" } }),
}));
vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: "0x0000000000000000000000000000000000000001",
    portfolioAddresses: { base: [], solana: [] },
    isConnected: true,
  }),
}));
vi.mock("@/hooks/usePositions", () => ({ usePositions: () => pageState }));
vi.mock("@/hooks/useOptimisticPositions", () => ({
  useOptimisticPositions: (positions: unknown[]) => positions,
}));
vi.mock("@/hooks/useActivity", () => ({ useActivity: () => ({ activity: null }) }));
vi.mock("@/hooks/useSpot", () => ({ useSpot: () => ({ spot: 0 }) }));
vi.mock("@/hooks/useNotificationStatus", () => ({
  useNotificationStatus: () => ({ enabled: false }),
}));
vi.mock("@/components/PortfolioSummary", () => ({
  PortfolioSummary: ({ positions }: { positions: unknown[] }) => (
    <div data-testid="summary-count">{positions.length}</div>
  ),
}));
vi.mock("@/components/EarningsChart", () => ({
  EarningsChart: ({ positions }: { positions: unknown[] }) => (
    <div data-testid="chart-count">{positions.length}</div>
  ),
}));
vi.mock("@/components/TradeLog", () => ({
  TradeLog: ({ items }: { items: unknown[] }) => (
    <div id="position-history" data-testid="trade-count">{items.length}</div>
  ),
}));
vi.mock("@/components/NotificationBanner", () => ({
  NotificationBanner: () => null,
}));
vi.mock("@/components/PositionCard", () => ({ PositionCard: () => null }));
vi.mock("@/components/RangePositionCard", () => ({ RangePositionCard: () => null }));

describe("PositionsPage bounded history", () => {
  beforeEach(() => {
    pageState.positions = [
      {
        id: "settled-1",
        indexed_at: "2026-08-03T10:00:00Z",
        is_settled: true,
        group_id: null,
      },
    ];
    pageState.settledHasMore = true;
    pageState.settledLoading = false;
    pageState.loadMoreSettled.mockClear();
  });

  it("offers an accessible one-page action and updates chart/log incrementally", async () => {
    const PositionsPage = (await import("@/app/positions/page")).default;
    const view = render(<PositionsPage />);

    const loadMore = screen.getByRole("button", { name: "Load older positions" });
    expect(loadMore).toHaveAttribute("aria-controls", "position-history");
    expect(screen.getByTestId("chart-count")).toHaveTextContent("1");
    expect(screen.getByTestId("trade-count")).toHaveTextContent("1");
    fireEvent.click(loadMore);
    expect(pageState.loadMoreSettled).toHaveBeenCalledTimes(1);

    pageState.positions = [
      ...pageState.positions,
      {
        id: "settled-2",
        indexed_at: "2026-08-02T10:00:00Z",
        is_settled: true,
        group_id: null,
      },
    ];
    pageState.settledLoading = true;
    view.rerender(<PositionsPage />);

    expect(screen.getByTestId("chart-count")).toHaveTextContent("2");
    expect(screen.getByTestId("trade-count")).toHaveTextContent("2");
    expect(
      screen.getByRole("button", { name: "Loading older positions…" }),
    ).toBeDisabled();
  });
});
