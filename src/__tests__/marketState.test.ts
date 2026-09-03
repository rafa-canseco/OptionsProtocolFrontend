import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Capacity, PriceQuote } from "@/lib/api";
import { ASSETS } from "@/lib/assets";

const ORIGINAL_ENV = { ...process.env };

async function loadMarketStateModule() {
  vi.resetModules();
  return import("@/lib/marketState");
}

function capacity(overrides: Partial<Capacity> = {}, asset = ASSETS.nvdac): Capacity {
  return {
    capacity: 1,
    capacity_usd: 1,
    market_open: true,
    market_status: "active",
    max_position: 1,
    mm_count: 1,
    updated_at: "2026-09-03T00:00:00Z",
    asset_chain: "base",
    asset_address: asset.address,
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

  it.each(["nvdac", "cbzec", "cbhype", "vvv"] as const)("requires canonical Base address identity for %s quotes", async (slug) => {
    const mod = await loadMarketStateModule();
    const asset = ASSETS[slug];
    const canonical = buildQuote({
      chain: "base",
      underlying_address: asset.address,
    });

    expect(mod.isCanonicalQuoteForAsset(canonical, asset)).toBe(true);
    expect(mod.isCanonicalQuoteForAsset({ ...canonical, underlying_address: "0x0000000000000000000000000000000000000001" }, asset)).toBe(false);
    expect(mod.isCanonicalQuoteForAsset({ ...canonical, chain: "solana" }, asset)).toBe(false);
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

  it("fails closed on malformed readiness status and boolean fields", async () => {
    const mod = await loadMarketStateModule();
    expect(mod.getAssetActionBlockReason(
      ASSETS.nvdac,
      capacity({ readiness_status: "unknown" } as unknown as Partial<Capacity>),
    )).toContain("risk checks are incomplete");
    expect(mod.getAssetActionBlockReason(
      ASSETS.nvdac,
      capacity({ backend_ready: "true" } as unknown as Partial<Capacity>),
    )).toContain("disabled by the backend");
    expect(mod.getAssetActionBlockReason(
      ASSETS.nvdac,
      capacity({ route_active: "true" } as unknown as Partial<Capacity>),
    )).toContain("route is not active");
    expect(mod.getAssetActionBlockReason(
      ASSETS.nvdac,
      capacity({ route_qualified: "true" } as unknown as Partial<Capacity>),
    )).toContain("route is not qualified");
  });

  it("allows every gated asset only for an affirmative canonical, active, qualified response", async () => {
    const mod = await loadMarketStateModule();

    for (const slug of ["nvdac", "cbzec", "cbhype", "vvv"] as const) {
      expect(mod.getAssetActionBlockReason(ASSETS[slug], null)).toContain("unavailable");
      expect(mod.getAssetActionBlockReason(ASSETS[slug], capacity({}, ASSETS[slug]))).toBeNull();
    }
    expect(mod.getAssetActionBlockReason(ASSETS.eth, null)).toBeNull();
  });

  it("pins the four canonical Base-mainnet asset identities and decimals", () => {
    expect({ address: ASSETS.nvdac.address, decimals: ASSETS.nvdac.collateralDecimals }).toEqual({ address: "0xb20000000000000000000078ee7ce2fE4908108C", decimals: 8 });
    expect({ address: ASSETS.cbzec.address, decimals: ASSETS.cbzec.collateralDecimals }).toEqual({ address: "0xB2000000000000000000008501b13360000cb2EC", decimals: 8 });
    expect({ address: ASSETS.cbhype.address, decimals: ASSETS.cbhype.collateralDecimals }).toEqual({ address: "0xB200000000000000000000451d033a5000cb479e", decimals: 18 });
    expect({ address: ASSETS.vvv.address, decimals: ASSETS.vvv.collateralDecimals }).toEqual({ address: "0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf", decimals: 18 });
  });

  it("uses the required tokenized-stock disclosure without an equity ownership claim", () => {
    expect(ASSETS.nvdac.disclosure?.instrument).toContain("economic-exposure and redemption instrument");
    expect(ASSETS.nvdac.disclosure?.instrument).toContain("not NVIDIA-issued registered equity");
    expect(ASSETS.nvdac.disclosure?.instrument).toContain("does not provide direct ownership");
    expect(ASSETS.nvdac.disclosure?.jurisdiction).toBeTruthy();
    expect(ASSETS.nvdac.disclosure?.eligibility).toBeTruthy();
    expect(ASSETS.nvdac.disclosure?.policyPause).toBeTruthy();
  });

  it.each(["cbzec", "cbhype", "vvv"] as const)("provides wrapped/token settlement risk disclosure for %s", (slug) => {
    expect(ASSETS[slug].disclosure?.instrument).toBeTruthy();
    expect(ASSETS[slug].disclosure?.jurisdiction).toBeTruthy();
    expect(ASSETS[slug].disclosure?.eligibility).toBeTruthy();
    expect(ASSETS[slug].disclosure?.policyPause).toBeTruthy();
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
