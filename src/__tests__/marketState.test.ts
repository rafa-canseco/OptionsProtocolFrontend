import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PriceQuote } from "@/lib/api";

const ORIGINAL_ENV = { ...process.env };

async function loadMarketStateModule() {
  vi.resetModules();
  return import("@/lib/marketState");
}

function buildQuote(overrides: Partial<PriceQuote> = {}): PriceQuote {
  return {
    option_type: "put",
    strike: 180,
    expiry_days: 7,
    expiry_date: "2026-04-29",
    premium: 12.5,
    delta: 0.25,
    iv: 0.6,
    spot: 175,
    ttl: 30,
    expires_at: 1_900_000_000,
    available_amount: 2,
    otoken_address: "mint123",
    signature: "sig123",
    mm_address: "maker123",
    bid_price_raw: 12_500_000,
    deadline: 1_900_000_030,
    quote_id: "quote-1",
    max_amount_raw: 200_000_000,
    maker_nonce: 7,
    position_count: 0,
    chain: "solana",
    ...overrides,
  };
}

describe("marketState helpers", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_DEPLOYMENT_ENV;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("treats Solana production assets as read-only", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    const mod = await loadMarketStateModule();

    expect(mod.isProductionReadOnlyAsset({ slug: "sol", chain: "solana" })).toBe(true);
    expect(mod.isProductionReadOnlyAsset({ slug: "tslax", chain: "solana" })).toBe(true);
    expect(mod.isProductionReadOnlyAsset({ slug: "eth", chain: "base" })).toBe(false);
  });

  it("keeps Solana assets tradable outside production", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "devnet";
    const mod = await loadMarketStateModule();

    expect(mod.isProductionReadOnlyAsset({ slug: "sol", chain: "solana" })).toBe(false);
  });

  it("detects executable quotes from backend execution fields", async () => {
    const mod = await loadMarketStateModule();

    expect(mod.isExecutableQuote(buildQuote())).toBe(true);
    expect(
      mod.isExecutableQuote(
        buildQuote({ otoken_address: null, signature: null, quote_id: null }),
      ),
    ).toBe(false);
  });
});
