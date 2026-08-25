import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type PositionStub = {
  id: string;
  indexed_at: string;
  is_settled: boolean;
  group_id: null;
  asset: string;
  strike_price: number;
};

const pageState = vi.hoisted(() => ({
  positions: [] as PositionStub[],
  loading: false,
  refresh: vi.fn(),
  loadMoreSettled: vi.fn().mockResolvedValue(undefined),
  settledHasMore: true,
  settledLoading: false,
  error: null,
}));

const ethPosition = (id: string, date: string): PositionStub => ({
  id,
  indexed_at: date,
  is_settled: true,
  group_id: null,
  asset: "eth",
  strike_price: 2_000,
});

vi.mock("@/lib/preferences", () => ({ useAppPreferences: () => ({ locale: "en" }) }));
vi.mock("@privy-io/react-auth", () => ({ usePrivy: () => ({ user: { id: "privy-user" } }) }));
vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: "0x0000000000000000000000000000000000000001",
    portfolioAddresses: { base: [], solana: [] },
    isConnected: true,
  }),
}));
vi.mock("@/hooks/usePositions", () => ({ usePositions: () => pageState }));
vi.mock("@/hooks/useOptimisticPositions", () => ({ useOptimisticPositions: (positions: PositionStub[]) => positions }));
vi.mock("@/hooks/useSpot", () => ({ useSpot: () => ({ spot: 0 }) }));
vi.mock("@/hooks/useNotificationStatus", () => ({ useNotificationStatus: () => ({ enabled: false }) }));
vi.mock("@/components/PortfolioSummary", () => ({
  PortfolioSummary: ({ positions }: { positions: unknown[] }) => <div data-testid="summary-count">{positions.length}</div>,
}));
vi.mock("@/components/EarningsChart", () => ({
  EarningsChart: ({ positions }: { positions: unknown[] }) => <div data-testid="chart-count">{positions.length}</div>,
}));
vi.mock("@/components/TradeLog", () => ({
  TradeLog: ({ items }: { items: unknown[] }) => <div id="position-history" data-testid="trade-count">{items.length}</div>,
}));
vi.mock("@/components/NotificationBanner", () => ({ NotificationBanner: () => null }));
vi.mock("@/components/PositionCard", () => ({ PositionCard: () => null }));
vi.mock("@/components/RangePositionCard", () => ({ RangePositionCard: () => null }));

describe("PositionsPage bounded B1 history", () => {
  beforeEach(() => {
    pageState.positions = [ethPosition("settled-1", "2026-08-03T10:00:00Z")];
    pageState.settledHasMore = true;
    pageState.settledLoading = false;
    pageState.loadMoreSettled.mockClear();
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
