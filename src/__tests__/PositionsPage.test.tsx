import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type PositionStub = {
  id: string;
  indexed_at: string;
  is_settled: boolean;
  group_id: string | null;
  asset: string;
  strike_price: number;
  is_put: boolean;
};

const pageState = vi.hoisted(() => ({
  positions: [] as PositionStub[],
  loading: false,
  refresh: vi.fn(),
  loadMoreSettled: vi.fn().mockResolvedValue(undefined),
  settledHasMore: true,
  settledLoading: false,
  error: null as string | null,
  activity: null as { totalVolume: number } | null,
  activityArgs: [] as (string | undefined)[],
}));

const ethPosition = (id: string, date: string): PositionStub => ({
  id,
  indexed_at: date,
  is_settled: true,
  group_id: null,
  asset: "eth",
  strike_price: 2_000,
  is_put: false,
});

vi.mock("@/lib/preferences", () => ({ useAppPreferences: () => ({ locale: "en" }) }));
vi.mock("@privy-io/react-auth", () => ({ usePrivy: () => ({ user: { id: "privy-user" } }) }));
vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: "0x0000000000000000000000000000000000000001",
    fundingAddress: "0x0000000000000000000000000000000000000002",
    portfolioAddresses: { base: [], solana: [] },
    isConnected: true,
  }),
}));
vi.mock("@/hooks/usePositions", () => ({ usePositions: () => pageState }));
vi.mock("@/hooks/useActivity", () => ({
  useActivity: (address: string | undefined, alsoAddress?: string) => {
    pageState.activityArgs = [address, alsoAddress];
    return { activity: pageState.activity };
  },
}));
vi.mock("@/hooks/useOptimisticPositions", () => ({ useOptimisticPositions: (positions: PositionStub[]) => positions }));
vi.mock("@/hooks/useSpot", () => ({ useSpot: () => ({ spot: 0 }) }));
vi.mock("@/hooks/useNotificationStatus", () => ({ useNotificationStatus: () => ({ enabled: false }) }));
vi.mock("@/components/PortfolioSummary", () => ({
  PortfolioSummary: ({ positions, activity }: { positions: unknown[]; activity: { totalVolume: number } | null }) => (
    <div data-testid="summary-count" data-total-volume={activity?.totalVolume ?? "missing"}>{positions.length}</div>
  ),
}));
vi.mock("@/components/EarningsChart", () => ({
  EarningsChart: ({ positions }: { positions: unknown[] }) => <div data-testid="chart-count">{positions.length}</div>,
}));
vi.mock("@/components/TradeLog", () => ({
  TradeLog: ({ items }: { items: unknown[] }) => <div id="position-history" data-testid="trade-count">{items.length}</div>,
}));
vi.mock("@/components/NotificationBanner", () => ({ NotificationBanner: () => null }));
vi.mock("@/components/PositionCard", () => ({
  PositionCard: ({ position, optimistic }: { position: PositionStub; optimistic?: boolean }) => (
    <div data-testid={`position-${position.id}`} data-optimistic={String(optimistic)} />
  ),
}));
vi.mock("@/components/RangePositionCard", () => ({
  RangePositionCard: ({ optimistic }: { optimistic?: boolean }) => (
    <div data-testid="range-card" data-optimistic={String(optimistic)} />
  ),
}));

describe("PositionsPage bounded B1 history", () => {
  beforeEach(() => {
    pageState.positions = [ethPosition("settled-1", "2026-08-03T10:00:00Z")];
    pageState.loading = false;
    pageState.error = null;
    pageState.settledHasMore = true;
    pageState.settledLoading = false;
    pageState.activity = null;
    pageState.activityArgs = [];
    pageState.refresh.mockClear();
    pageState.loadMoreSettled.mockClear();
  });

  it("marks unindexed new positions for expiry reconciliation and loads activity totals", async () => {
    pageState.positions = [{
      ...ethPosition("opt-new-position", "2026-10-29T03:00:00Z"),
      is_settled: false,
    }];
    pageState.activity = { totalVolume: 11.65 };
    const PositionsPage = (await import("@/app/positions/page")).default;
    render(<PositionsPage />);

    expect(screen.getByTestId("position-opt-new-position")).toHaveAttribute("data-optimistic", "true");
    expect(screen.getByTestId("summary-count")).toHaveAttribute("data-total-volume", "11.65");
    expect(pageState.activityArgs).toEqual([
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000002",
    ]);
  });

  it("marks a range pending when either leg is unindexed", async () => {
    pageState.positions = [
      { ...ethPosition("opt-put", "2026-10-29T03:00:00Z"), is_settled: false, group_id: "range-1", is_put: true },
      { ...ethPosition("real-call", "2026-10-29T03:00:00Z"), is_settled: false, group_id: "range-1", is_put: false },
    ];
    const PositionsPage = (await import("@/app/positions/page")).default;
    render(<PositionsPage />);

    expect(screen.getByTestId("range-card")).toHaveAttribute("data-optimistic", "true");
  });

  it("keeps cached positions visible during background refresh", async () => {
    pageState.loading = true;
    const PositionsPage = (await import("@/app/positions/page")).default;
    render(<PositionsPage />);

    expect(screen.getByTestId("summary-count")).toHaveTextContent("1");
  });

  it("replaces an endless empty skeleton with a retryable error", async () => {
    pageState.positions = [];
    pageState.error = "Request timed out. Try again.";
    pageState.settledHasMore = false;
    const PositionsPage = (await import("@/app/positions/page")).default;
    render(<PositionsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(pageState.refresh).toHaveBeenCalledOnce();
  });

  it("keeps older history reachable when the current page contains only removed assets", async () => {
    pageState.positions = [{
      ...ethPosition("legacy-sol", "2026-08-01T10:00:00Z"),
      asset: "sol",
      strike_price: 180,
    }];
    pageState.settledHasMore = true;
    const PositionsPage = (await import("@/app/positions/page")).default;
    render(<PositionsPage />);

    expect(screen.queryByText("No positions yet")).not.toBeInTheDocument();
    expect(screen.getByTestId("summary-count")).toHaveTextContent("0");
    fireEvent.click(screen.getByRole("button", { name: "Load older positions" }));
    expect(pageState.loadMoreSettled).toHaveBeenCalledOnce();
  });

  it("loads history incrementally and excludes removed assets from every visible total", async () => {
    const PositionsPage = (await import("@/app/positions/page")).default;
    const view = render(<PositionsPage />);

    const loadMore = screen.getByRole("button", { name: "Load older positions" });
    expect(loadMore).toHaveAttribute("aria-controls", "position-history");
    expect(screen.getByTestId("summary-count")).toHaveTextContent("1");
    expect(screen.getByTestId("chart-count")).toHaveTextContent("1");
    fireEvent.click(loadMore);
    expect(pageState.loadMoreSettled).toHaveBeenCalledOnce();

    pageState.positions = [
      ...pageState.positions,
      ethPosition("settled-2", "2026-08-02T10:00:00Z"),
      {
        ...ethPosition("legacy-sol", "2026-08-01T10:00:00Z"),
        asset: "sol",
        strike_price: 180,
      },
    ];
    pageState.settledLoading = true;
    view.rerender(<PositionsPage />);

    expect(screen.getByTestId("summary-count")).toHaveTextContent("2");
    expect(screen.getByTestId("chart-count")).toHaveTextContent("2");
    expect(screen.getByTestId("trade-count")).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Loading older positions…" })).toBeDisabled();
  });
});
