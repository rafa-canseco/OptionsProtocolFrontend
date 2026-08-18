import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, type Position } from "@/lib/api";
import {
  createAccountPortfolioSource,
  createWalletPortfolioSource,
  parseDirectPortfolioSnapshot,
  parsePortfolioPage,
  parsePortfolioSnapshot,
  PositionPortfolioProtocolError,
} from "@/lib/positionPortfolioApi";

function row(id: string): Position {
  return {
    id,
    indexed_at: "2026-08-03T10:00:00Z",
    updated_at: "2026-08-03T10:00:00Z",
    is_settled: false,
  } as Position;
}

const bounded = {
  positions: [row("initial")],
  pagination: {
    bounded: true as const,
    watermark: "2026-08-03T10:10:00Z",
    active: { limit: 50, has_more: true, next_cursor: "opaque-active" },
    settled: { limit: 20, has_more: false, next_cursor: null },
  },
};

function directHeaders(): Headers {
  return new Headers({
    "X-Portfolio-Bounded": "true",
    "X-Portfolio-Watermark": "2026-08-03T10:10:00Z",
    "X-Active-Limit": "50",
    "X-Active-Has-More": "true",
    "X-Active-Next-Cursor": "opaque-active-cursor",
    "X-Settled-Limit": "20",
    "X-Settled-Has-More": "false",
  });
}

describe("position portfolio API adapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("normalizes account and wallet-batch snapshots to the same model", async () => {
    vi.spyOn(api, "getB1naryPositionPortfolio").mockResolvedValue(bounded);
    vi.spyOn(api, "getPositionPortfolioBatch").mockResolvedValue(bounded);

    const account = await createAccountPortfolioSource("privy-user").getSnapshot();
    const batch = await createWalletPortfolioSource([
      { chain: "base", address: "0x0000000000000000000000000000000000000001" },
      { chain: "solana", address: "SolanaCaseSensitive" },
    ]).getSnapshot();

    expect(account).toEqual({ ...batch, route: "account" });
    expect(batch.route).toBe("wallet_batch");
    expect(api.getPositionPortfolioBatch).toHaveBeenCalledTimes(1);
  });

  it("passes opaque cursors and changed-after through without inspecting them", async () => {
    vi.spyOn(api, "getB1naryPositionPortfolio").mockResolvedValue({
      positions: [row("change")],
      stream: "changes",
      limit: 100,
      has_more: false,
      next_cursor: null,
      watermark: "2026-08-03T10:20:00Z",
    });
    const source = createAccountPortfolioSource("privy-user");
    const request = {
      stream: "changes" as const,
      cursor: "v1.opaque+/=token",
      limit: 100,
      changedAfter: "2026-08-03T10:10:00Z",
    };

    await source.getPage(request, "account");

    expect(api.getB1naryPositionPortfolio).toHaveBeenCalledWith(
      "privy-user",
      request,
    );
  });

  it("rejects malformed bounded metadata instead of treating it as legacy", () => {
    expect(() =>
      parsePortfolioSnapshot(
        {
          ...bounded,
          pagination: {
            ...bounded.pagination,
            active: { limit: 50, has_more: true, next_cursor: null },
          },
        },
        "wallet_batch",
      ),
    ).toThrow(PositionPortfolioProtocolError);
    expect(() =>
      parsePortfolioPage(
        {
          positions: [],
          stream: "active",
          limit: 100,
          has_more: false,
          next_cursor: "unexpected",
          watermark: "2026-08-03T10:20:00Z",
        },
        "active",
        "account",
      ),
    ).toThrow(PositionPortfolioProtocolError);
  });

  it.each([404, 405, 501])(
    "uses bounded direct headers and direct continuations when batch returns %i",
    async (status) => {
      vi.spyOn(api, "getPositionPortfolioBatch").mockRejectedValue(
        new ApiError(status, { message: "unavailable" }),
      );
      const directRead = vi
        .spyOn(api, "getPositionPortfolioDirect")
        .mockImplementation(async (_address, request) => {
          if (!request) {
            return { data: [row("initial")], headers: directHeaders() };
          }
          return {
            data: {
              positions: [row("continued")],
              stream: "active",
              limit: 100,
              has_more: false,
              next_cursor: null,
              watermark: "2026-08-03T10:10:00Z",
            },
            headers: new Headers(),
          };
        });
      const source = createWalletPortfolioSource([
        {
          chain: "base",
          address: "0x0000000000000000000000000000000000000001",
        },
      ]);

      const snapshot = await source.getSnapshot();
      expect(snapshot).toMatchObject({
        mode: "bounded",
        pagination: {
          active: { next_cursor: "opaque-active-cursor" },
        },
      });
      const continuation = await source.getPage(
        {
          stream: "active",
          cursor: "opaque-active-cursor",
          limit: 100,
        },
        snapshot.route,
      );

      expect(continuation.positions).toEqual([row("continued")]);
      expect(api.getPositionPortfolioBatch).toHaveBeenCalledTimes(1);
      expect(directRead).toHaveBeenNthCalledWith(
        2,
        "0x0000000000000000000000000000000000000001",
        {
          stream: "active",
          cursor: "opaque-active-cursor",
          limit: 100,
        },
      );
    },
  );

  it.each([404, 405, 501])(
    "fails closed on explicit wallet_batch snapshot refresh when batch returns %i",
    async (status) => {
      const batchRead = vi
        .spyOn(api, "getPositionPortfolioBatch")
        .mockResolvedValueOnce(bounded)
        .mockRejectedValueOnce(new ApiError(status, { message: "unavailable" }));
      const directRead = vi.spyOn(api, "getPositionPortfolioDirect");
      const source = createWalletPortfolioSource([
        {
          chain: "base",
          address: "0x0000000000000000000000000000000000000001",
        },
      ]);

      const snapshot = await source.getSnapshot();
      expect(snapshot.route).toBe("wallet_batch");

      await expect(source.getSnapshot(snapshot.route)).rejects.toMatchObject({
        status,
      });
      expect(batchRead).toHaveBeenCalledTimes(2);
      expect(directRead).not.toHaveBeenCalled();
    },
  );

  it("selects legacy only for an old bare array with no bounded headers", async () => {
    expect(
      parsePortfolioSnapshot(
        { positions: [row("legacy")], errors: [] },
        "account",
      ),
    ).toEqual({
      mode: "legacy",
      positions: [row("legacy")],
      route: "account",
    });
    vi.spyOn(api, "getPositionPortfolioBatch").mockRejectedValue(
      new ApiError(404, { message: "not found" }),
    );
    const directRead = vi.spyOn(api, "getPositionPortfolioDirect").mockResolvedValue({
      data: [row("old-route")],
      headers: new Headers(),
    });
    const source = createWalletPortfolioSource([
      {
        chain: "base",
        address: "0x0000000000000000000000000000000000000001",
      },
    ]);

    const snapshot = await source.getSnapshot();
    expect(snapshot).toEqual({
      mode: "legacy",
      positions: [row("old-route")],
      route: "wallet_direct",
    });
    await source.getSnapshot(snapshot.route);

    expect(api.getPositionPortfolioBatch).toHaveBeenCalledTimes(1);
    expect(directRead).toHaveBeenCalledTimes(2);
  });

  it("fails on malformed or incomplete bounded direct headers", () => {
    const missingCursor = directHeaders();
    missingCursor.delete("X-Active-Next-Cursor");
    expect(() => parseDirectPortfolioSnapshot([row("one")], missingCursor)).toThrow(
      PositionPortfolioProtocolError,
    );

    expect(() =>
      parseDirectPortfolioSnapshot(
        [row("one")],
        new Headers({ "X-Active-Limit": "50" }),
      ),
    ).toThrow(PositionPortfolioProtocolError);

    const falseBounded = directHeaders();
    falseBounded.set("X-Portfolio-Bounded", "false");
    expect(() => parseDirectPortfolioSnapshot([row("one")], falseBounded)).toThrow(
      PositionPortfolioProtocolError,
    );
  });

  it("never falls back or fans out when multiple wallets lose the batch route", async () => {
    vi.spyOn(api, "getPositionPortfolioBatch").mockRejectedValue(
      new ApiError(501, { message: "not implemented" }),
    );
    const directRead = vi.spyOn(api, "getPositionPortfolioDirect");
    const legacyRead = vi.spyOn(api, "getPositions");

    await expect(
      createWalletPortfolioSource([
        {
          chain: "base",
          address: "0x0000000000000000000000000000000000000001",
        },
        {
          chain: "base",
          address: "0x0000000000000000000000000000000000000002",
        },
      ]).getSnapshot(),
    ).rejects.toThrow("aggregated portfolio endpoint");

    expect(api.getPositionPortfolioBatch).toHaveBeenCalledTimes(1);
    expect(directRead).not.toHaveBeenCalled();
    expect(legacyRead).not.toHaveBeenCalled();
  });
});
