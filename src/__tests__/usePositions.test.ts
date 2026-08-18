import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { clearDataInvalidations, invalidateData } from "@/lib/dataInvalidation";
import { clearSharedRequests } from "@/lib/sharedRequest";

const apiMock = vi.hoisted(() => ({
  getPositions: vi.fn(),
  getPositionPortfolioDirect: vi.fn(),
  getB1naryPositionPortfolio: vi.fn(),
  getPositionPortfolioBatch: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, api: apiMock };
});

function position(
  id: string,
  options: { settled?: boolean; updatedAt?: string } = {},
) {
  return {
    id,
    indexed_at: "2026-08-03T10:00:00Z",
    updated_at: options.updatedAt ?? "2026-08-03T10:00:00Z",
    is_settled: options.settled ?? false,
    settled_at: options.settled ? "2026-08-03T10:00:00Z" : null,
  };
}

function snapshot(
  positions: ReturnType<typeof position>[] = [],
  options: {
    watermark?: string;
    activeCursor?: string | null;
    settledCursor?: string | null;
  } = {},
) {
  return {
    positions,
    errors: [],
    pagination: {
      bounded: true,
      watermark: options.watermark ?? "2026-08-03T10:10:00Z",
      active: {
        limit: 50,
        has_more: Boolean(options.activeCursor),
        next_cursor: options.activeCursor ?? null,
      },
      settled: {
        limit: 20,
        has_more: Boolean(options.settledCursor),
        next_cursor: options.settledCursor ?? null,
      },
    },
  };
}

function directSnapshotHeaders(
  activeCursor: string | null,
  settledCursor: string | null,
): Headers {
  const headers = new Headers({
    "X-Portfolio-Bounded": "true",
    "X-Portfolio-Watermark": "2026-08-03T10:10:00Z",
    "X-Active-Limit": "50",
    "X-Active-Has-More": String(activeCursor !== null),
    "X-Settled-Limit": "20",
    "X-Settled-Has-More": String(settledCursor !== null),
  });
  if (activeCursor) headers.set("X-Active-Next-Cursor", activeCursor);
  if (settledCursor) headers.set("X-Settled-Next-Cursor", settledCursor);
  return headers;
}

function page(
  stream: "active" | "settled" | "changes",
  positions: ReturnType<typeof position>[] = [],
  options: { cursor?: string | null; watermark?: string } = {},
) {
  return {
    positions,
    errors: [],
    stream,
    limit: 100,
    has_more: Boolean(options.cursor),
    next_cursor: options.cursor ?? null,
    watermark: options.watermark ?? "2026-08-03T10:20:00Z",
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

async function flushRequests() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("usePositions", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    clearSharedRequests();
    clearDataInvalidations();
    apiMock.getPositions.mockResolvedValue([]);
    apiMock.getPositionPortfolioDirect.mockResolvedValue({
      data: [],
      headers: new Headers(),
    });
    apiMock.getB1naryPositionPortfolio.mockResolvedValue(snapshot());
    apiMock.getPositionPortfolioBatch.mockResolvedValue(snapshot());
    apiMock.trackEvent.mockResolvedValue({ ok: true });
  });

  it("renders the bounded snapshot, drains active, and loads one settled page per action", async () => {
    apiMock.getB1naryPositionPortfolio.mockImplementation(
      async (
        _userId: string,
        request?: { stream?: string; cursor?: string | null },
      ) => {
        if (!request) {
          return snapshot(
            [position("initial-active"), position("recent", { settled: true })],
            { activeCursor: "active-1", settledCursor: "settled-1" },
          );
        }
        if (request.stream === "active") {
          return page("active", [position("older-active")], {
            watermark: "2026-08-03T10:10:00Z",
          });
        }
        if (request.stream === "settled") {
          return page(
            "settled",
            [
              position(
                request.cursor === "settled-2"
                  ? "oldest-settled"
                  : "older-settled",
                { settled: true },
              ),
            ],
            {
              cursor: request.cursor === "settled-1" ? "settled-2" : null,
              watermark: "2026-08-03T10:10:00Z",
            },
          );
        }
        return page("changes");
      },
    );

    const { usePositions } = await import("@/hooks/usePositions");
    const { result, unmount } = renderHook(() =>
      usePositions(undefined, undefined, undefined, 60_000, undefined, "privy-1"),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() =>
      expect(result.current.positions.map((item) => item.id)).toContain("older-active"),
    );
    expect(
      apiMock.getB1naryPositionPortfolio.mock.calls.filter(
        ([, request]) => request?.stream === "settled",
      ),
    ).toHaveLength(0);
    expect(result.current.settledHasMore).toBe(true);

    await act(async () => {
      await Promise.all([
        result.current.loadMoreSettled(),
        result.current.loadMoreSettled(),
      ]);
    });

    expect(result.current.positions.map((item) => item.id)).toContain("older-settled");
    let settledRequests = apiMock.getB1naryPositionPortfolio.mock.calls.filter(
      ([, request]) => request?.stream === "settled",
    );
    expect(settledRequests).toHaveLength(1);
    expect(result.current.settledHasMore).toBe(true);

    await act(async () => result.current.refresh());
    await act(async () => result.current.loadMoreSettled());

    settledRequests = apiMock.getB1naryPositionPortfolio.mock.calls.filter(
      ([, request]) => request?.stream === "settled",
    );
    expect(settledRequests).toHaveLength(2);
    expect(settledRequests[1][1]).toMatchObject({ cursor: "settled-2" });
    expect(result.current.positions.map((item) => item.id)).toContain(
      "oldest-settled",
    );
    expect(result.current.settledHasMore).toBe(false);
    unmount();
  });

  it("uses one normalized batch request for direct wallets without N+1 reads", async () => {
    const { usePositions } = await import("@/hooks/usePositions");
    const { result, unmount } = renderHook(() =>
      usePositions(
        "0xAbCd",
        "0xABCD",
        ["SolCase", "solcase", "SolCase"],
        60_000,
        ["0xabcd"],
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiMock.getPositionPortfolioBatch).toHaveBeenCalledTimes(1);
    expect(apiMock.getPositionPortfolioBatch).toHaveBeenCalledWith([
      { chain: "base", address: "0xabcd" },
      { chain: "solana", address: "SolCase" },
      { chain: "solana", address: "solcase" },
    ]);
    expect(apiMock.getPositions).not.toHaveBeenCalled();
    expect(apiMock.getPositionPortfolioDirect).not.toHaveBeenCalled();
    unmount();
  });

  it("keeps explicit legacy whole-snapshot replacement", async () => {
    apiMock.getB1naryPositionPortfolio
      .mockResolvedValueOnce({ positions: [position("old")], errors: [] })
      .mockResolvedValueOnce({ positions: [position("new")], errors: [] });

    const { usePositions } = await import("@/hooks/usePositions");
    const { result, unmount } = renderHook(() =>
      usePositions(undefined, undefined, undefined, 60_000, undefined, "privy-1"),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.positions.map((item) => item.id)).toEqual(["old"]);

    await act(async () => result.current.refresh());

    expect(result.current.positions.map((item) => item.id)).toEqual(["new"]);
    unmount();
  });

  it("fails closed when a persisted wallet_batch legacy snapshot refresh becomes unavailable", async () => {
    apiMock.getPositionPortfolioBatch
      .mockResolvedValueOnce({ positions: [position("batch-legacy")], errors: [] })
      .mockRejectedValueOnce(
        new ApiError(404, { message: "batch unavailable" }),
      );

    const { usePositions } = await import("@/hooks/usePositions");
    const { result, unmount } = renderHook(() =>
      usePositions("0x0000000000000000000000000000000000000001", undefined),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.positions.map((item) => item.id)).toEqual([
      "batch-legacy",
    ]);

    await act(async () => result.current.refresh());

    expect(result.current.error).toContain("API 404: batch unavailable");
    expect(result.current.positions.map((item) => item.id)).toEqual([
      "batch-legacy",
    ]);
    expect(apiMock.getPositionPortfolioBatch).toHaveBeenCalledTimes(2);
    expect(apiMock.getPositionPortfolioDirect).not.toHaveBeenCalled();
    unmount();
  });

  it("ignores obsolete pages after the portfolio identity changes", async () => {
    const userA = deferred<ReturnType<typeof snapshot>>();
    const userB = deferred<ReturnType<typeof snapshot>>();
    apiMock.getB1naryPositionPortfolio.mockImplementation((userId: string) =>
      userId === "privy-a" ? userA.promise : userB.promise,
    );

    const { usePositions } = await import("@/hooks/usePositions");
    const { result, rerender, unmount } = renderHook(
      ({ userId }: { userId: string }) =>
        usePositions(undefined, undefined, undefined, 60_000, undefined, userId),
      { initialProps: { userId: "privy-a" } },
    );
    await flushRequests();
    rerender({ userId: "privy-b" });
    expect(result.current.loading).toBe(true);
    expect(result.current.positions).toEqual([]);
    await flushRequests();

    await act(async () => userB.resolve(snapshot([position("user-b")])));
    await waitFor(() =>
      expect(result.current.positions.map((item) => item.id)).toEqual(["user-b"]),
    );
    await act(async () => userA.resolve(snapshot([position("user-a")])));
    expect(result.current.positions.map((item) => item.id)).toEqual(["user-b"]);
    unmount();
  });

  it("does not page settled history or poll while hidden", async () => {
    vi.useFakeTimers();
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    apiMock.getB1naryPositionPortfolio.mockResolvedValue(
      snapshot([position("recent", { settled: true })], {
        settledCursor: "settled-1",
      }),
    );

    const { usePositions } = await import("@/hooks/usePositions");
    const { result, unmount } = renderHook(() =>
      usePositions(undefined, undefined, undefined, 15_000, undefined, "privy-1"),
    );
    await flushRequests();
    expect(apiMock.getB1naryPositionPortfolio).toHaveBeenCalledTimes(1);

    visibility = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => result.current.loadMoreSettled());
    await act(async () => vi.advanceTimersByTimeAsync(60_000));

    expect(apiMock.getB1naryPositionPortfolio).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("publishes the snapshot before active drain finishes and pauses continuations when hidden", async () => {
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    const firstContinuation = deferred<ReturnType<typeof page>>();
    apiMock.getB1naryPositionPortfolio.mockImplementation(
      async (_userId: string, request?: { stream?: string; cursor?: string | null }) => {
        if (!request) {
          return snapshot([position("snapshot-row")], { activeCursor: "active-1" });
        }
        if (request.stream === "changes") return page("changes");
        if (request.stream === "active" && request.cursor === "active-1") {
          return firstContinuation.promise;
        }
        if (request.stream === "active" && request.cursor === "active-2") {
          return page("active", [position("final-active")], {
            watermark: "2026-08-03T10:10:00Z",
          });
        }
        return page("active");
      },
    );

    const { usePositions } = await import("@/hooks/usePositions");
    const { result, unmount } = renderHook(() =>
      usePositions(undefined, undefined, undefined, 60_000, undefined, "privy-1"),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.positions.map((item) => item.id)).toEqual(["snapshot-row"]);

    visibility = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () =>
      firstContinuation.resolve(
        page("active", [position("continued-active")], {
          cursor: "active-2",
          watermark: "2026-08-03T10:10:00Z",
        }),
      ),
    );
    expect(
      apiMock.getB1naryPositionPortfolio.mock.calls.filter(
        ([, request]) => request?.cursor === "active-2",
      ),
    ).toHaveLength(0);

    visibility = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await waitFor(() =>
      expect(
        apiMock.getB1naryPositionPortfolio.mock.calls.filter(
          ([, request]) => request?.cursor === "active-2",
        ),
      ).toHaveLength(1),
    );
    expect(result.current.positions.map((item) => item.id)).toContain("final-active");
    unmount();
  });

  it("replays a partial delta from the committed watermark and advances only after completion", async () => {
    const changesRequests: Array<{ cursor?: string | null; changedAfter?: string | null }> = [];
    let continuationAttempts = 0;
    apiMock.getB1naryPositionPortfolio.mockImplementation(
      async (_userId: string, request?: { stream?: string; cursor?: string | null; changedAfter?: string | null }) => {
        if (!request) return snapshot([], { watermark: "2026-08-03T10:10:00Z" });
        if (request.stream === "active") return page("active");
        if (request.stream === "changes") {
          changesRequests.push(request);
          if (!request.cursor) {
            return page("changes", [position("settled", { settled: true })], {
              cursor: "changes-1",
              watermark: request.changedAfter === "2026-08-03T10:20:00Z"
                ? "2026-08-03T10:30:00Z"
                : "2026-08-03T10:20:00Z",
            });
          }
          continuationAttempts += 1;
          if (continuationAttempts === 1) throw new Error("temporary page failure");
          return page("changes", [position("settled", { settled: true })], {
            watermark: "2026-08-03T10:20:00Z",
          });
        }
        return page("settled");
      },
    );

    const { usePositions } = await import("@/hooks/usePositions");
    const { result, unmount } = renderHook(() =>
      usePositions(undefined, undefined, undefined, 60_000, undefined, "privy-1"),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.refresh());
    expect(result.current.positions.map((item) => item.id)).toEqual(["settled"]);
    expect(result.current.error).toContain("temporary page failure");

    await act(async () => result.current.refresh());
    expect(changesRequests[0]).toMatchObject({
      cursor: null,
      changedAfter: "2026-08-03T10:10:00Z",
    });
    expect(changesRequests[2]).toMatchObject({
      cursor: null,
      changedAfter: "2026-08-03T10:10:00Z",
    });
    expect(result.current.positions).toHaveLength(1);

    await act(async () => result.current.refresh());
    expect(changesRequests[4]?.changedAfter).toBe("2026-08-03T10:20:00Z");
    unmount();
  });

  it("coalesces identical initial reads across hook consumers", async () => {
    const pending = deferred<ReturnType<typeof snapshot>>();
    apiMock.getB1naryPositionPortfolio.mockReturnValue(pending.promise);
    const { usePositions } = await import("@/hooks/usePositions");

    const first = renderHook(() =>
      usePositions(undefined, undefined, undefined, 60_000, undefined, "privy-1"),
    );
    const second = renderHook(() =>
      usePositions(undefined, undefined, undefined, 60_000, undefined, "privy-1"),
    );
    await flushRequests();
    expect(apiMock.getB1naryPositionPortfolio).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve(snapshot([position("shared")])));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    first.unmount();
    second.unmount();
  });

  it("preserves a coalesced direct snapshot route for every second-consumer continuation", async () => {
    const address = "0x0000000000000000000000000000000000000001";
    const pendingSnapshot = deferred<{
      data: ReturnType<typeof position>[];
      headers: Headers;
    }>();
    apiMock.getPositionPortfolioBatch.mockRejectedValue(
      new ApiError(404, { message: "batch unavailable" }),
    );
    apiMock.getPositionPortfolioDirect.mockImplementation(
      async (_address: string, request?: { stream?: "active" | "settled" | "changes" }) => {
        if (!request) return pendingSnapshot.promise;
        return {
          data: page(
            request.stream ?? "active",
            [position(`${request.stream}-continued`, {
              settled: request.stream === "settled",
            })],
            {
              watermark:
                request.stream === "changes"
                  ? "2026-08-03T10:20:00Z"
                  : "2026-08-03T10:10:00Z",
            },
          ),
          headers: new Headers(),
        };
      },
    );

    const { usePositions } = await import("@/hooks/usePositions");
    const first = renderHook(() => usePositions(address, undefined));
    await flushRequests();
    const second = renderHook(() => usePositions(address, undefined));
    await flushRequests();

    expect(apiMock.getPositionPortfolioBatch).toHaveBeenCalledTimes(1);
    expect(apiMock.getPositionPortfolioDirect).toHaveBeenCalledTimes(1);
    first.unmount();

    await act(async () =>
      pendingSnapshot.resolve({
        data: [position("direct-snapshot")],
        headers: directSnapshotHeaders("direct-active", "direct-settled"),
      }),
    );
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    await waitFor(() =>
      expect(
        apiMock.getPositionPortfolioDirect.mock.calls.some(
          ([, request]) => request?.stream === "active" && request.cursor === "direct-active",
        ),
      ).toBe(true),
    );

    await act(async () => second.result.current.loadMoreSettled());
    await act(async () => second.result.current.refresh());

    const directStreams = apiMock.getPositionPortfolioDirect.mock.calls
      .map(([, request]) => request?.stream)
      .filter(Boolean);
    expect(directStreams).toEqual(
      expect.arrayContaining(["active", "settled", "changes"]),
    );
    expect(apiMock.getPositionPortfolioBatch).toHaveBeenCalledTimes(1);
    expect(apiMock.getPositionPortfolioBatch.mock.calls).not.toContainEqual([
      expect.anything(),
      expect.objectContaining({ stream: expect.any(String) }),
    ]);
    second.unmount();
  });

  it("keeps one trailing refresh for repeated transaction invalidations", async () => {
    const initial = deferred<ReturnType<typeof snapshot>>();
    apiMock.getB1naryPositionPortfolio.mockReturnValueOnce(initial.promise);
    const { usePositions } = await import("@/hooks/usePositions");
    const { result, unmount } = renderHook(() =>
      usePositions(undefined, undefined, undefined, 60_000, undefined, "privy-1"),
    );
    await flushRequests();

    act(() => {
      invalidateData(["positions"], "trade-confirmed");
      invalidateData(["positions"], "trade-confirmed");
    });
    await act(async () => initial.resolve(snapshot()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() =>
      expect(
        apiMock.getB1naryPositionPortfolio.mock.calls.filter(
          ([, request]) => request?.stream === "active",
        ),
      ).toHaveLength(1),
    );
    expect(
      apiMock.getB1naryPositionPortfolio.mock.calls.filter(
        ([, request]) => request?.stream === "changes",
      ),
    ).toHaveLength(1);
    unmount();
  });
});
