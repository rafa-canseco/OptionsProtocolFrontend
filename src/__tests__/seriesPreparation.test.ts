import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  type EnsureSeriesRequest,
  type EnsureSeriesResponse,
  type PriceQuote,
} from "@/lib/api";
import {
  buildEnsureSeriesRequest,
  buildSeriesIdempotencyKey,
  prepareSeries,
  SeriesPreparationError,
} from "@/lib/seriesPreparation";

function buildQuote(overrides: Partial<PriceQuote> = {}): PriceQuote {
  return {
    option_type: "put",
    strike: 2300,
    expiry_days: 8,
    expiry_date: "2026-05-01",
    premium: 0.28,
    delta: -0.1,
    iv: 0.6,
    spot: 2326,
    ttl: 60,
    expires_at: 1_900_000_000,
    available_amount: 5,
    otoken_address: "0x0000000000000000000000000000000000000001",
    signature: "0xsig",
    mm_address: "0x0000000000000000000000000000000000000002",
    bid_price_raw: 280_000,
    deadline: 1_900_000_030,
    quote_id: "42",
    max_amount_raw: 200_000_000,
    maker_nonce: 7,
    position_count: 0,
    chain: "base",
    ...overrides,
  };
}

function ready(
  request: EnsureSeriesRequest,
  overrides: Partial<EnsureSeriesResponse> = {},
): EnsureSeriesResponse {
  return {
    status: "ready",
    otoken_address: request.expected_otoken_address,
    execution_quote: request.quote,
    ...overrides,
  };
}

function expectPreparationError(
  error: unknown,
  kind: SeriesPreparationError["kind"],
) {
  expect(error).toBeInstanceOf(SeriesPreparationError);
  expect((error as SeriesPreparationError).kind).toBe(kind);
}

describe("series preparation", () => {
  it("serializes every raw EIP-712 value as a decimal string", () => {
    const request = buildEnsureSeriesRequest(
      buildQuote(),
      "0xSmartWallet",
      "478260",
    );

    expect(request).toEqual({
      wallet_address: "0xSmartWallet",
      expected_otoken_address: "0x0000000000000000000000000000000000000001",
      amount_raw: "478260",
      quote: {
        otoken_address: "0x0000000000000000000000000000000000000001",
        bid_price_raw: "280000",
        deadline: "1900000030",
        quote_id: "42",
        max_amount_raw: "200000000",
        maker_nonce: "7",
        signature: "0xsig",
        mm_address: "0x0000000000000000000000000000000000000002",
      },
    });
    expect(buildSeriesIdempotencyKey(request)).toContain(
      "0xsmartwallet:0x0000000000000000000000000000000000000001:42:1900000030:478260",
    );
  });

  it("preserves the legacy API status prefix for existing callers", () => {
    expect(new ApiError(429, { message: "Rate limited." }).message).toContain(
      "API 429:",
    );
  });

  it("returns the exact ready execution quote on the fast path", async () => {
    const ensure = vi.fn(
      async (request: EnsureSeriesRequest) => ready(request),
    );

    const result = await prepareSeries({
      quote: buildQuote({ deployment_status: "ready" }),
      walletAddress: "0xSmartWallet",
      amountRaw: "478260",
      accessToken: "token",
      ensure,
    });

    expect(ensure).toHaveBeenCalledTimes(1);
    expect(result.deployment_status).toBe("ready");
    expect(result.bid_price_raw).toBe("280000");
  });

  it("polls idempotently from creating to ready", async () => {
    const keys: string[] = [];
    const ensure = vi.fn(
      async (
        request: EnsureSeriesRequest,
        _token: string,
        options: { idempotencyKey: string },
      ) => {
        keys.push(options.idempotencyKey);
        if (keys.length === 1) {
          return {
            ...ready(request),
            status: "creating" as const,
            retry_after_ms: 1,
          };
        }
        return ready(request);
      },
    );

    await prepareSeries({
      quote: buildQuote({ deployment_status: "virtual" }),
      walletAddress: "0xSmartWallet",
      amountRaw: "478260",
      accessToken: "token",
      ensure,
    });

    expect(ensure).toHaveBeenCalledTimes(2);
    expect(new Set(keys).size).toBe(1);
  });

  it("times out a creating series without returning an executable quote", async () => {
    const ensure = vi.fn(
      async (request: EnsureSeriesRequest) => ({
        ...ready(request),
        status: "creating" as const,
        retry_after_ms: 1,
      }),
    );

    await expect(
      prepareSeries({
        quote: buildQuote(),
        walletAddress: "0xSmartWallet",
        amountRaw: "478260",
        accessToken: "token",
        timeoutMs: 10,
        ensure,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expectPreparationError(error, "timeout");
      expect((error as SeriesPreparationError).retryable).toBe(true);
      return true;
    });
  });

  it("maps stale API conflicts and never accepts changed terms", async () => {
    const staleEnsure = vi.fn(async () => {
      throw new ApiError(409, {
        code: "QUOTE_EXPIRED",
        message: "Quote expired.",
        retryable: false,
      });
    });

    await expect(
      prepareSeries({
        quote: buildQuote(),
        walletAddress: "0xSmartWallet",
        amountRaw: "478260",
        accessToken: "token",
        ensure: staleEnsure,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expectPreparationError(error, "stale");
      return true;
    });

    const changedEnsure = vi.fn(async (request: EnsureSeriesRequest) =>
      ready(request, {
        execution_quote: { ...request.quote, signature: "0xchanged" },
      }),
    );
    await expect(
      prepareSeries({
        quote: buildQuote(),
        walletAddress: "0xSmartWallet",
        amountRaw: "478260",
        accessToken: "token",
        ensure: changedEnsure,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expectPreparationError(error, "stale");
      return true;
    });
  });

  it("maps expired authentication without retrying automatically", async () => {
    const ensure = vi.fn(async () => {
      throw new ApiError(401, {
        code: "AUTH_REQUIRED",
        message: "Expired.",
      });
    });

    await expect(
      prepareSeries({
        quote: buildQuote(),
        walletAddress: "0xSmartWallet",
        amountRaw: "478260",
        accessToken: "token",
        ensure,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expectPreparationError(error, "auth");
      return true;
    });
    expect(ensure).toHaveBeenCalledTimes(1);
  });

  it("aborts immediately when the review modal unmounts", async () => {
    const controller = new AbortController();
    const ensure = vi.fn(
      () => new Promise<EnsureSeriesResponse>(() => undefined),
    );
    const pending = prepareSeries({
      quote: buildQuote(),
      walletAddress: "0xSmartWallet",
      amountRaw: "478260",
      accessToken: "token",
      signal: controller.signal,
      ensure,
    });

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(ensure).toHaveBeenCalledTimes(1);
  });
});
