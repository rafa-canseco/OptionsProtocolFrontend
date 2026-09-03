import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Capacity, PriceQuote } from "@/lib/api";
import { ASSETS } from "@/lib/assets";

const ORIGINAL_ENV = { ...process.env };

async function loadMarketStateModule() {
  vi.resetModules();
  return import("@/lib/marketState");
}

function capacity(overrides: Partial<Capacity> = {}): Capacity {
  return {
    capacity: 1,
    capacity_usd: 1,
    market_open: true,
    market_status: "active",
    max_position: 1,
    mm_count: 1,
    updated_at: "2026-09-03T00:00:00Z",
    asset_chain: "base",
    asset_address: ASSETS.nvdac.address,
    backend_ready: true,
    route_active: true,
    route_qualified: true,
    readiness_status: "ready",
    ...overrides,
  };
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
    delete process.env.NEXT_PUBLIC_SOLANA_ENABLED;
    delete process.env.NEXT_PUBLIC_LAZY_OTOKEN_ENABLED;
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

  it("keeps Solana assets tradable in production when explicitly enabled", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    process.env.NEXT_PUBLIC_SOLANA_ENABLED = "true";
    const mod = await loadMarketStateModule();

    expect(mod.isProductionReadOnlyAsset({ slug: "sol", chain: "solana" })).toBe(false);
    expect(mod.isProductionReadOnlyAsset({ slug: "tslax", chain: "solana" })).toBe(false);
    expect(mod.isSolanaOffInProd()).toBe(false);
  });

  it("flags Solana as off in production (mainnet)", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    const mod = await loadMarketStateModule();

    expect(mod.isSolanaOffInProd()).toBe(true);
  });

  it("keeps Solana on outside production (devnet/testnet)", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "devnet";
    const devnetMod = await loadMarketStateModule();
    expect(devnetMod.isSolanaOffInProd()).toBe(false);

    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "testnet";
    const testnetMod = await loadMarketStateModule();
    expect(testnetMod.isSolanaOffInProd()).toBe(false);
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

  it("keeps eager rollout safe by default", async () => {
    const mod = await loadMarketStateModule();

    expect(mod.isLazyOTokenEnabled()).toBe(false);
    expect(mod.isExecutableQuote(buildQuote({ deployment_status: "virtual" }))).toBe(false);
    expect(mod.isExecutableQuote(buildQuote({ deployment_status: "creating" }))).toBe(false);
    expect(mod.isExecutableQuote(buildQuote({ deployment_status: "ready" }))).toBe(true);
    expect(mod.isExecutableQuote(buildQuote({ deployment_status: "failed" }))).toBe(false);
    expect(mod.isExecutableQuote(buildQuote({ deployment_status: undefined }))).toBe(true);
  });

  it("allows virtual and creating firm quotes only when lazy rollout is enabled", async () => {
    process.env.NEXT_PUBLIC_LAZY_OTOKEN_ENABLED = "true";
    const mod = await loadMarketStateModule();

    expect(mod.isLazyOTokenEnabled()).toBe(true);
    expect(mod.isExecutableQuote(buildQuote({ deployment_status: "virtual" }))).toBe(true);
    expect(mod.isExecutableQuote(buildQuote({ deployment_status: "creating" }))).toBe(true);
    expect(mod.isExecutableQuote(buildQuote({ deployment_status: "failed" }))).toBe(false);
  });

  it("keeps lazy series out of the two-leg range flow", async () => {
    const mod = await loadMarketStateModule();

    expect(mod.isRangeExecutableQuote(buildQuote({ deployment_status: "ready" }))).toBe(true);
    expect(mod.isRangeExecutableQuote(buildQuote({ deployment_status: undefined }))).toBe(true);
    expect(mod.isRangeExecutableQuote(buildQuote({ deployment_status: "virtual" }))).toBe(false);
    expect(mod.isRangeExecutableQuote(buildQuote({ deployment_status: "creating" }))).toBe(false);
    expect(mod.isRangeExecutableQuote(buildQuote({ deployment_status: "failed" }))).toBe(false);
  });

  it("requires canonical Base address identity for NVDAc quotes", async () => {
    const mod = await loadMarketStateModule();
    const canonical = buildQuote({
      chain: "base",
      underlying_address: ASSETS.nvdac.address,
    });

    expect(mod.isCanonicalQuoteForAsset(canonical, ASSETS.nvdac)).toBe(true);
    expect(mod.isCanonicalQuoteForAsset({ ...canonical, underlying_address: "0x0000000000000000000000000000000000000001" }, ASSETS.nvdac)).toBe(false);
    expect(mod.isCanonicalQuoteForAsset({ ...canonical, chain: "solana" }, ASSETS.nvdac)).toBe(false);
  });

  it.each([
    [{ readiness_status: "disabled" }, "disabled by the backend"],
    [{ readiness_status: "paused" }, "paused by route or policy controls"],
    [{ readiness_status: "policy_paused" }, "paused by policy controls"],
    [{ readiness_status: "stale_oracle" }, "price oracle is stale"],
    [{ readiness_status: "excessive_impact" }, "price impact exceeds"],
    [{ readiness_status: "unqualified" }, "route is not qualified"],
    [{ route_active: false }, "route is not active"],
    [{ route_qualified: false }, "route is not qualified"],
  ] as const)("fails closed with a specific NVDAc readiness reason", async (overrides, reason) => {
    const mod = await loadMarketStateModule();
    expect(mod.getAssetActionBlockReason(ASSETS.nvdac, capacity(overrides))).toContain(reason);
  });

  it("allows NVDAc only for an affirmative canonical, active, qualified response", async () => {
    const mod = await loadMarketStateModule();

    expect(mod.getAssetActionBlockReason(ASSETS.nvdac, null)).toContain("unavailable");
    expect(mod.getAssetActionBlockReason(ASSETS.nvdac, capacity())).toBeNull();
    expect(mod.getAssetActionBlockReason(ASSETS.eth, null)).toBeNull();
  });

  it("uses the required tokenized-stock disclosure without an equity ownership claim", () => {
    expect(ASSETS.nvdac.disclosure?.instrument).toContain("economic-exposure and redemption instrument");
    expect(ASSETS.nvdac.disclosure?.instrument).toContain("not NVIDIA-issued registered equity");
    expect(ASSETS.nvdac.disclosure?.instrument).toContain("does not provide direct ownership");
    expect(ASSETS.nvdac.disclosure?.jurisdiction).toBeTruthy();
    expect(ASSETS.nvdac.disclosure?.eligibility).toBeTruthy();
    expect(ASSETS.nvdac.disclosure?.policyPause).toBeTruthy();
  });

  it("replaces a selected quote when signed fields refresh at the same strike", async () => {
    const mod = await loadMarketStateModule();
    const selected = buildQuote({ quote_id: "41", signature: "old" });
    const refreshed = buildQuote({
      quote_id: "42",
      signature: "new",
      deadline: "1900000040",
    });

    expect(mod.reconcileSelectedQuote(selected, [refreshed])).toBe(refreshed);
  });
});
