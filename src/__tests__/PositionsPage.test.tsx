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
  spotCalls: [] as string[],
  spotEnabled: [] as { asset: string; enabled: boolean }[],
  cardProps: [] as { spot?: number; optimistic?: boolean }[],
  positionCalls: [] as unknown[][],
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
    fundingAddress: "0x0000000000000000000000000000000000000003",
    portfolioAddresses: {
      base: ["0x0000000000000000000000000000000000000002"],
      solana: [],
    },
    isConnected: true,
  }),
}));
vi.mock("@/hooks/usePositions", () => ({
  usePositions: (...args: unknown[]) => {
    pageState.positionCalls.push(args);
    return pageState;
  },
}));
vi.mock("@/hooks/useOptimisticPositions", () => ({ useOptimisticPositions: (positions: PositionStub[]) => positions }));
vi.mock("@/hooks/useSpot", () => ({
  useSpot: (asset: string, _interval?: number, enabled = true) => {
    pageState.spotCalls.push(asset);
    pageState.spotEnabled.push({ asset, enabled });
    return { spot: asset === "cbhype" ? 85.1 : 2_509 };
  },
}));
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
vi.mock("@/components/PositionCard", () => ({
  PositionCard: (props: { spot?: number; optimistic?: boolean }) => {
    pageState.cardProps.push(props);
    return null;
  },
}));
vi.mock("@/components/RangePositionCard", () => ({ RangePositionCard: () => null }));

describe("PositionsPage bounded B1 history", () => {
  beforeEach(() => {
    pageState.positions = [ethPosition("settled-1", "2026-08-03T10:00:00Z")];
    pageState.settledHasMore = true;
    pageState.settledLoading = false;
    pageState.spotCalls = [];
    pageState.spotEnabled = [];
    pageState.cardProps = [];
    pageState.positionCalls = [];
    pageState.loadMoreSettled.mockClear();
  });

  it("passes connected, account, and funding wallet identities to Positions", async () => {
    const PositionsPage = (await import("@/app/positions/page")).default;
    render(<PositionsPage />);

    expect(pageState.positionCalls.at(-1)).toEqual([
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000003",
      [],
      15_000,
      ["0x0000000000000000000000000000000000000002"],
      "privy-user",
    ]);
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

  it("does not poll cbHYPE spot when there is no cbHYPE position", async () => {
    pageState.positions = [];
    pageState.settledHasMore = false;
    const PositionsPage = (await import("@/app/positions/page")).default;
    render(<PositionsPage />);

    expect(pageState.spotEnabled).toContainEqual({ asset: "cbhype", enabled: false });
  });

  it("shows cbHYPE's own spot and marks the unindexed optimistic position as confirming", async () => {
    pageState.positions = [{
      ...ethPosition("opt-cbhype", "2026-10-10T18:00:00Z"),
      is_settled: false,
      asset: "cbhype",
      strike_price: 8_000_000_000,
    }];
    pageState.settledHasMore = false;
    const PositionsPage = (await import("@/app/positions/page")).default;
    render(<PositionsPage />);

    expect(pageState.spotCalls).toContain("cbhype");
    expect(pageState.spotEnabled.at(-1)).toEqual({ asset: "cbhype", enabled: true });
    expect(pageState.cardProps.at(-1)).toMatchObject({ spot: 85.1, optimistic: true });
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
