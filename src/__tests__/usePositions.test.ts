import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const apiMock = vi.hoisted(() => ({
  getPositions: vi.fn(),
  getB1naryPositionsByPrivyUserId: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: apiMock,
}));

function position(id: string) {
  return {
    id,
    indexed_at: "2026-05-06T00:00:00Z",
  };
}

describe("usePositions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getPositions.mockResolvedValue([]);
    apiMock.getB1naryPositionsByPrivyUserId.mockResolvedValue({
      positions: [],
      errors: [],
    });
  });

  it("merges b1nary account positions with address fallbacks and dedupes", async () => {
    apiMock.getB1naryPositionsByPrivyUserId.mockResolvedValue({
      positions: [position("shared"), position("account-only")],
      errors: [],
    });
    apiMock.getPositions.mockImplementation(async (address: string) => {
      if (address === "0xSmart") return [position("shared")];
      if (address === "SolanaEmbedded") return [position("solana-only")];
      return [];
    });

    const { usePositions } = await import("@/hooks/usePositions");
    const { result } = renderHook(() =>
      usePositions(
        "0xSmart",
        undefined,
        ["SolanaEmbedded"],
        60_000,
        [],
        "privy-user-1",
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiMock.getB1naryPositionsByPrivyUserId).toHaveBeenCalledWith(
      "privy-user-1",
    );
    expect(result.current.positions.map((p) => p.id)).toEqual([
      "shared",
      "account-only",
      "solana-only",
    ]);
  });
});
