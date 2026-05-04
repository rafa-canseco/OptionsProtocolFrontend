import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function loadDeploymentModule() {
  vi.resetModules();
  return import("@/lib/deployment");
}

describe("deployment helpers", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN;
    delete process.env.NEXT_PUBLIC_DEPLOYMENT_ENV;
    delete process.env.NEXT_PUBLIC_FEATURED_ASSET;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to multi chain when unset", async () => {
    const mod = await loadDeploymentModule();
    expect(mod.getDeploymentChain()).toBe("multi");
  });

  it("returns solana when configured", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "solana";
    const mod = await loadDeploymentModule();
    expect(mod.getDeploymentChain()).toBe("solana");
  });

  it("returns base when configured", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "base";
    const mod = await loadDeploymentModule();
    expect(mod.getDeploymentChain()).toBe("base");
  });

  it("falls back to multi for unknown values", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "ethereum";
    const mod = await loadDeploymentModule();
    expect(mod.getDeploymentChain()).toBe("multi");
  });

  it("defaults deployment env to mainnet", async () => {
    const mod = await loadDeploymentModule();
    expect(mod.getDeploymentEnv()).toBe("mainnet");
    expect(mod.isDevnet()).toBe(false);
  });

  it("detects devnet", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "devnet";
    const mod = await loadDeploymentModule();
    expect(mod.getDeploymentEnv()).toBe("devnet");
    expect(mod.isDevnet()).toBe(true);
  });

  it("defaults the featured asset to eth on multi deploys", async () => {
    const mod = await loadDeploymentModule();
    expect(mod.getFeaturedAssetSlug()).toBe("eth");
  });

  it("defaults the featured asset to sol on solana deploys", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "solana";
    const mod = await loadDeploymentModule();
    expect(mod.getFeaturedAssetSlug()).toBe("sol");
  });

  it("respects a valid featured asset override", async () => {
    process.env.NEXT_PUBLIC_FEATURED_ASSET = "tslax";
    const mod = await loadDeploymentModule();
    expect(mod.getFeaturedAssetSlug()).toBe("tslax");
  });

  it("ignores an invalid featured asset override", async () => {
    process.env.NEXT_PUBLIC_FEATURED_ASSET = "doge";
    const mod = await loadDeploymentModule();
    expect(mod.getFeaturedAssetSlug()).toBe("eth");
  });

  it("returns a chain label for each deployment", async () => {
    let mod = await loadDeploymentModule();
    expect(mod.getChainLabel()).toBe("Base + Solana");

    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "base";
    mod = await loadDeploymentModule();
    expect(mod.getChainLabel()).toBe("Base");

    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "solana";
    mod = await loadDeploymentModule();
    expect(mod.getChainLabel()).toBe("Solana");
  });

  it("returns the expected hero line", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "solana";
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "devnet";
    let mod = await loadDeploymentModule();
    expect(mod.getHeroChainLine()).toBe("Solana devnet preview. Base mainnet live.");

    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "base";
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    mod = await loadDeploymentModule();
    expect(mod.getHeroChainLine()).toBe("Now live on Base. Solana devnet preview.");

    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "solana";
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    mod = await loadDeploymentModule();
    expect(mod.getHeroChainLine()).toBe("Now live on Solana. Base mainnet live.");
  });

  it("returns the alternate subdomain link", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "base";
    let mod = await loadDeploymentModule();
    expect(mod.getOtherSubdomain()).toEqual({
      label: "Solana devnet →",
      href: "https://solana.b1nary.app",
    });

    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "solana";
    mod = await loadDeploymentModule();
    expect(mod.getOtherSubdomain()).toEqual({
      label: "Base (live) →",
      href: "https://app.b1nary.app",
    });
  });
});
