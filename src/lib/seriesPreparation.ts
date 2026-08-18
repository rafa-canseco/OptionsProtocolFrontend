import {
  ApiError,
  api,
  type EnsureSeriesRequest,
  type EnsureSeriesResponse,
  type ExecutionQuoteSnapshot,
  type PriceQuote,
} from "@/lib/api";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_MS = 1_000;
const MIN_RETRY_MS = 250;
const MAX_RETRY_MS = 2_000;

const STALE_CODES = new Set([
  "QUOTE_STALE",
  "QUOTE_EXPIRED",
  "MAKER_NONCE_CHANGED",
  "CAPACITY_EXCEEDED",
  "INSUFFICIENT_CAPACITY",
]);

export type SeriesPreparationFailureKind =
  | "timeout"
  | "stale"
  | "auth"
  | "failed";

export class SeriesPreparationError extends Error {
  readonly kind: SeriesPreparationFailureKind;
  readonly code?: string;
  readonly retryable: boolean;

  constructor(
    kind: SeriesPreparationFailureKind,
    message: string,
    options?: { code?: string; retryable?: boolean },
  ) {
    super(message);
    this.name = "SeriesPreparationError";
    this.kind = kind;
    this.code = options?.code;
    this.retryable = options?.retryable ?? false;
  }
}

export interface PrepareSeriesOptions {
  quote: PriceQuote;
  walletAddress: string;
  amountRaw: string;
  accessToken: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onCreating?: () => void;
  ensure?: (
    request: EnsureSeriesRequest,
    accessToken: string,
    options: { signal: AbortSignal; idempotencyKey: string },
  ) => Promise<EnsureSeriesResponse>;
}

function requireExecutionSnapshot(quote: PriceQuote): ExecutionQuoteSnapshot {
  if (
    !quote.otoken_address ||
    quote.bid_price_raw == null ||
    quote.deadline == null ||
    !quote.quote_id ||
    quote.max_amount_raw == null ||
    quote.maker_nonce == null ||
    !quote.signature ||
    !quote.mm_address
  ) {
    throw new SeriesPreparationError(
      "stale",
      "This quote is incomplete. Refresh it before trying again.",
      { code: "QUOTE_INCOMPLETE" },
    );
  }

  return {
    otoken_address: quote.otoken_address,
    bid_price_raw: String(quote.bid_price_raw),
    deadline: String(quote.deadline),
    quote_id: quote.quote_id,
    max_amount_raw: String(quote.max_amount_raw),
    maker_nonce: String(quote.maker_nonce),
    signature: quote.signature,
    mm_address: quote.mm_address,
  };
}

export function buildEnsureSeriesRequest(
  quote: PriceQuote,
  walletAddress: string,
  amountRaw: string,
): EnsureSeriesRequest {
  return {
    wallet_address: walletAddress,
    expected_otoken_address: quote.otoken_address ?? "",
    amount_raw: amountRaw,
    quote: requireExecutionSnapshot(quote),
  };
}

export function buildSeriesIdempotencyKey(
  request: EnsureSeriesRequest,
): string {
  return [
    "series",
    request.wallet_address.toLowerCase(),
    request.expected_otoken_address.toLowerCase(),
    request.quote.quote_id,
    request.quote.deadline,
    request.amount_raw,
  ].join(":");
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function assertReadyResponse(
  request: EnsureSeriesRequest,
  response: EnsureSeriesResponse,
): void {
  if (
    !sameAddress(response.otoken_address, request.expected_otoken_address) ||
    !sameAddress(
      response.execution_quote.otoken_address,
      request.expected_otoken_address,
    )
  ) {
    throw new SeriesPreparationError(
      "stale",
      "The prepared series does not match this quote. Refresh before trying again.",
      { code: "SERIES_ADDRESS_MISMATCH" },
    );
  }

  const expected = request.quote;
  const actual = response.execution_quote;
  const exactFields: Array<keyof ExecutionQuoteSnapshot> = [
    "bid_price_raw",
    "deadline",
    "quote_id",
    "max_amount_raw",
    "maker_nonce",
    "signature",
  ];
  const termsChanged =
    !sameAddress(actual.mm_address, expected.mm_address) ||
    exactFields.some((field) => actual[field] !== expected[field]);

  if (termsChanged) {
    throw new SeriesPreparationError(
      "stale",
      "This quote changed while the trade was being prepared. Refresh it before continuing.",
      { code: "QUOTE_CHANGED" },
    );
  }
}

function applyExecutionQuote(
  quote: PriceQuote,
  executionQuote: ExecutionQuoteSnapshot,
): PriceQuote {
  return {
    ...quote,
    otoken_address: executionQuote.otoken_address,
    bid_price_raw: executionQuote.bid_price_raw,
    deadline: executionQuote.deadline,
    quote_id: executionQuote.quote_id,
    max_amount_raw: executionQuote.max_amount_raw,
    maker_nonce: executionQuote.maker_nonce,
    signature: executionQuote.signature,
    mm_address: executionQuote.mm_address,
    deployment_status: "ready",
  };
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function waitFor(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? abortError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function raceWithAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason ?? abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function mapApiError(error: ApiError): SeriesPreparationError {
  const code = error.detail.code;
  if (error.status === 401 || error.status === 403) {
    return new SeriesPreparationError(
      "auth",
      "Your session expired. Reconnect your wallet and try again.",
      { code, retryable: false },
    );
  }
  if (error.status === 409 || (code && STALE_CODES.has(code))) {
    return new SeriesPreparationError(
      "stale",
      error.detail.message ||
        "This quote changed or expired. Refresh it before trying again.",
      { code, retryable: false },
    );
  }

  const retryable =
    error.detail.retryable ??
    (error.status === 429 || error.status >= 500);
  return new SeriesPreparationError(
    "failed",
    error.detail.message ||
      (error.status === 429
        ? "Trade preparation is busy. Wait a moment and retry."
        : "Could not prepare this trade. Please retry."),
    { code, retryable },
  );
}

export async function prepareSeries(
  options: PrepareSeriesOptions,
): Promise<PriceQuote> {
  const request = buildEnsureSeriesRequest(
    options.quote,
    options.walletAddress,
    options.amountRaw,
  );
  const ensure = options.ensure ?? api.ensureSeries;
  const idempotencyKey = buildSeriesIdempotencyKey(request);
  const controller = new AbortController();
  let timedOut = false;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(abortError());
  }, timeoutMs);
  const forwardAbort = () =>
    controller.abort(options.signal?.reason ?? abortError());
  options.signal?.addEventListener("abort", forwardAbort, { once: true });

  try {
    while (true) {
      const response = await raceWithAbort(
        ensure(request, options.accessToken, {
          signal: controller.signal,
          idempotencyKey,
        }),
        controller.signal,
      );

      if (response.status === "ready") {
        assertReadyResponse(request, response);
        return applyExecutionQuote(options.quote, response.execution_quote);
      }
      if (response.status !== "creating") {
        throw new SeriesPreparationError(
          "failed",
          "The trade preparation service returned an invalid state. Please retry.",
          { code: "INVALID_PREPARATION_STATE", retryable: true },
        );
      }

      options.onCreating?.();
      const retryMs = Math.min(
        MAX_RETRY_MS,
        Math.max(MIN_RETRY_MS, response.retry_after_ms ?? DEFAULT_RETRY_MS),
      );
      await waitFor(retryMs, controller.signal);
    }
  } catch (error) {
    if (timedOut) {
      throw new SeriesPreparationError(
        "timeout",
        "The trade is still preparing. Retry to check whether it is ready.",
        { code: "PREPARATION_TIMEOUT", retryable: true },
      );
    }
    if (options.signal?.aborted) {
      throw options.signal.reason ?? abortError();
    }
    if (error instanceof SeriesPreparationError) throw error;
    if (error instanceof ApiError) throw mapApiError(error);
    throw new SeriesPreparationError(
      "failed",
      "Could not prepare this trade. Check your connection and retry.",
      { code: "PREPARATION_UNAVAILABLE", retryable: true },
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", forwardAbort);
  }
}
