import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";

describe("position portfolio HTTP contract", () => {
  afterEach(() => vi.restoreAllMocks());

  it("encodes account page filters and preserves the opaque cursor value", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          positions: [],
          stream: "changes",
          limit: 100,
          has_more: false,
          next_cursor: null,
          watermark: "2026-08-03T10:20:00Z",
        }),
        { status: 200 },
      ),
    );

    await api.getB1naryPositionPortfolio("privy/user?", {
      stream: "changes",
      cursor: "v1.opaque+/=token",
      limit: 100,
      changedAfter: "2026-08-03T10:10:00Z",
    });

    const calledUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(calledUrl.pathname).toBe("/b1nary-account/positions");
    expect(calledUrl.searchParams.get("privy_user_id")).toBe("privy/user?");
    expect(calledUrl.searchParams.get("stream")).toBe("changes");
    expect(calledUrl.searchParams.get("cursor")).toBe("v1.opaque+/=token");
    expect(calledUrl.searchParams.get("changed_after")).toBe(
      "2026-08-03T10:10:00Z",
    );
  });

  it("preserves direct snapshot headers and sends continuations to the direct route", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: {
            "X-Portfolio-Bounded": "true",
            "X-Portfolio-Watermark": "2026-08-03T10:20:00Z",
            "X-Active-Limit": "50",
            "X-Active-Has-More": "true",
            "X-Active-Next-Cursor": "opaque-active-cursor",
            "X-Settled-Limit": "20",
            "X-Settled-Has-More": "false",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            positions: [],
            stream: "active",
            limit: 100,
            has_more: false,
            next_cursor: null,
            watermark: "2026-08-03T10:20:00Z",
          }),
          { status: 200 },
        ),
      );
    const address = "0x0000000000000000000000000000000000000001";

    const snapshot = await api.getPositionPortfolioDirect(address);
    await api.getPositionPortfolioDirect(address, {
      stream: "active",
      cursor: "opaque-active-cursor",
      limit: 100,
    });

    expect(snapshot.data).toEqual([]);
    expect(snapshot.headers.get("X-Portfolio-Bounded")).toBe("true");
    const snapshotUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(snapshotUrl.pathname).toBe(`/positions/${address}`);
    expect(snapshotUrl.search).toBe("");
    const pageUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(pageUrl.pathname).toBe(`/positions/${address}`);
    expect(pageUrl.searchParams.get("stream")).toBe("active");
    expect(pageUrl.searchParams.get("cursor")).toBe("opaque-active-cursor");
    expect(pageUrl.searchParams.get("limit")).toBe("100");
  });

  it("sends all direct wallets and continuation fields in one POST", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          positions: [],
          stream: "settled",
          limit: 100,
          has_more: false,
          next_cursor: null,
          watermark: "2026-08-03T10:20:00Z",
        }),
        { status: 200 },
      ),
    );
    const wallets = [
      { chain: "base" as const, address: "0x0000000000000000000000000000000000000001" },
      { chain: "solana" as const, address: "CaseSensitiveSolana" },
    ];

    await api.getPositionPortfolioBatch(wallets, {
      stream: "settled",
      cursor: "opaque-cursor",
      limit: 100,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://localhost:8000/positions/batch");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      wallets,
      stream: "settled",
      cursor: "opaque-cursor",
      limit: 100,
      changed_after: null,
    });
  });
});
