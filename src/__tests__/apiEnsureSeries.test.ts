import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  api,
  type EnsureSeriesRequest,
  type EnsureSeriesResponse,
} from "@/lib/api";

const request: EnsureSeriesRequest = {
  wallet_address: "0xSmartWallet",
  expected_otoken_address: "0xOtoken",
  amount_raw: "478260",
  quote: {
    otoken_address: "0xOtoken",
    bid_price_raw: "280000",
    deadline: "1900000030",
    quote_id: "42",
    max_amount_raw: "200000000",
    maker_nonce: "7",
    signature: "0xsig",
    mm_address: "0xMaker",
  },
};

const readyResponse: EnsureSeriesResponse = {
  status: "ready",
  otoken_address: request.expected_otoken_address,
  execution_quote: request.quote,
};

describe("api.ensureSeries", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends Privy auth, idempotency, abort signal, and the captured snapshot", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => readyResponse,
    });
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(
      api.ensureSeries(request, "privy-token", {
        signal: controller.signal,
        idempotencyKey: "series-key",
      }),
    ).resolves.toEqual(readyResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/series/ensure",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request),
        signal: controller.signal,
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer privy-token",
          "Idempotency-Key": "series-key",
        }),
      }),
    );
  });

  it("parses FastAPI structured errors while preserving the legacy prefix", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        text: async () =>
          JSON.stringify({
            detail: {
              code: "QUOTE_EXPIRED",
              message: "Quote expired.",
              retryable: false,
            },
          }),
      }),
    );

    await expect(
      api.ensureSeries(request, "privy-token"),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.message).toContain("API 409:");
      expect(apiError.detail).toEqual({
        code: "QUOTE_EXPIRED",
        message: "Quote expired.",
        retryable: false,
      });
      return true;
    });
  });
});
