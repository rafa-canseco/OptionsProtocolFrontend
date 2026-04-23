# B1N-295 — Solana Devnet Frontend + Multi-Chain Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `solana.b1nary.app` devnet frontend with SOL + mock TSLAx, and redesign the landing copy so both subdomains tell a multi-chain (Base + Solana devnet) story.

**Architecture:** Introduce a single deployment helper (`src/lib/deployment.ts`) that returns featured asset, chain label, hero chain line, and cross-subdomain link, keyed off `NEXT_PUBLIC_DEPLOYMENT_CHAIN` / `NEXT_PUBLIC_DEPLOYMENT_ENV`. Landing and earn components consume this helper instead of hard-coding "ETH" / "Base". A new `DevnetBanner` renders on devnet deploys. TSLAx joins the `ASSETS` registry and the Solana balance hook.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, TailwindCSS, Framer Motion, Vitest + @testing-library/react, Privy wallet auth, viem + @solana/web3.js.

**Design doc:** `docs/superpowers/specs/2026-04-20-b1n-295-solana-devnet-landing-tslax-design.md`

**Linear:** [B1N-295](https://linear.app/b1nary/issue/B1N-295/frontendvercel-polish-solana-devnet-app-with-tslax-on-solanab1naryapp)

**Branch:** `feat/b1n-295-solana-devnet-tslax`

---

## Pre-flight

- [ ] **Step 0: Confirm branch**

Run: `git status && git branch --show-current`
Expected: clean tree, branch `feat/b1n-295-solana-devnet-tslax`. If not on branch:
```bash
git checkout -b feat/b1n-295-solana-devnet-tslax
```

---

## Task 1: Deployment helper module

**Files:**
- Create: `src/lib/deployment.ts`
- Create: `src/__tests__/deployment.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/deployment.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";

const ORIGINAL = { ...process.env };

function reload() {
  // Re-import with a cache-busting query to pick up changed env vars
  return import(`@/lib/deployment?t=${Date.now()}`);
}

describe("deployment helpers", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN;
    delete process.env.NEXT_PUBLIC_DEPLOYMENT_ENV;
    delete process.env.NEXT_PUBLIC_FEATURED_ASSET;
  });

  afterEach(() => {
    Object.assign(process.env, ORIGINAL);
  });

  it("defaults to multi chain when unset", async () => {
    const mod = await reload();
    expect(mod.getDeploymentChain()).toBe("multi");
  });

  it("returns solana when env is solana", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "solana";
    const mod = await reload();
    expect(mod.getDeploymentChain()).toBe("solana");
  });

  it("returns base when env is base", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "base";
    const mod = await reload();
    expect(mod.getDeploymentChain()).toBe("base");
  });

  it("falls back to multi for unknown values", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "ethereum";
    const mod = await reload();
    expect(mod.getDeploymentChain()).toBe("multi");
  });

  it("defaults deployment env to mainnet", async () => {
    const mod = await reload();
    expect(mod.getDeploymentEnv()).toBe("mainnet");
    expect(mod.isDevnet()).toBe(false);
  });

  it("detects devnet env", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "devnet";
    const mod = await reload();
    expect(mod.getDeploymentEnv()).toBe("devnet");
    expect(mod.isDevnet()).toBe(true);
  });

  it("featured asset defaults to eth when multi", async () => {
    const mod = await reload();
    expect(mod.getFeaturedAssetSlug()).toBe("eth");
  });

  it("featured asset is sol on solana deploy", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "solana";
    const mod = await reload();
    expect(mod.getFeaturedAssetSlug()).toBe("sol");
  });

  it("featured asset respects explicit override", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "solana";
    process.env.NEXT_PUBLIC_FEATURED_ASSET = "tslax";
    const mod = await reload();
    expect(mod.getFeaturedAssetSlug()).toBe("tslax");
  });

  it("featured asset ignores invalid override", async () => {
    process.env.NEXT_PUBLIC_FEATURED_ASSET = "doge";
    const mod = await reload();
    expect(mod.getFeaturedAssetSlug()).toBe("eth");
  });

  it("chain label is Base + Solana when multi", async () => {
    const mod = await reload();
    expect(mod.getChainLabel()).toBe("Base + Solana");
  });

  it("chain label is Base when base", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "base";
    const mod = await reload();
    expect(mod.getChainLabel()).toBe("Base");
  });

  it("chain label is Solana when solana", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "solana";
    const mod = await reload();
    expect(mod.getChainLabel()).toBe("Solana");
  });

  it("hero line on base mainnet", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "base";
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "mainnet";
    const mod = await reload();
    expect(mod.getHeroChainLine()).toBe("Now live on Base. Solana devnet preview.");
  });

  it("hero line on solana devnet", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "solana";
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "devnet";
    const mod = await reload();
    expect(mod.getHeroChainLine()).toBe("Solana devnet preview. Base mainnet live.");
  });

  it("other subdomain link from base points to solana", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "base";
    const mod = await reload();
    expect(mod.getOtherSubdomain()).toEqual({
      label: "Solana devnet →",
      href: "https://solana.b1nary.app",
    });
  });

  it("other subdomain link from solana points to base", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN = "solana";
    const mod = await reload();
    expect(mod.getOtherSubdomain()).toEqual({
      label: "Base (live) →",
      href: "https://app.b1nary.app",
    });
  });

  it("other subdomain link is null on multi", async () => {
    const mod = await reload();
    expect(mod.getOtherSubdomain()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/deployment.test.ts`
Expected: FAIL — module `@/lib/deployment` does not exist.

- [ ] **Step 3: Create `src/lib/deployment.ts`**

```ts
import { ASSETS } from "@/lib/assets";

export type DeploymentChain = "base" | "solana" | "multi";
export type DeploymentEnv = "mainnet" | "testnet" | "devnet";

const BASE_SUBDOMAIN = "https://app.b1nary.app";
const SOLANA_SUBDOMAIN = "https://solana.b1nary.app";

export function getDeploymentChain(): DeploymentChain {
  const raw = process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN;
  if (raw === "base" || raw === "solana" || raw === "multi") return raw;
  return "multi";
}

export function getDeploymentEnv(): DeploymentEnv {
  const raw = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV;
  if (raw === "mainnet" || raw === "testnet" || raw === "devnet") return raw;
  return "mainnet";
}

export function isDevnet(): boolean {
  return getDeploymentEnv() === "devnet";
}

export function getFeaturedAssetSlug(): string {
  const override = process.env.NEXT_PUBLIC_FEATURED_ASSET;
  if (override && override in ASSETS) return override;
  return getDeploymentChain() === "solana" ? "sol" : "eth";
}

export function getChainLabel(): string {
  switch (getDeploymentChain()) {
    case "base": return "Base";
    case "solana": return "Solana";
    case "multi": return "Base + Solana";
  }
}

export function getHeroChainLine(): string {
  const chain = getDeploymentChain();
  const env = getDeploymentEnv();
  if (chain === "solana" && env === "devnet") return "Solana devnet preview. Base mainnet live.";
  if (chain === "base" && env === "mainnet") return "Now live on Base. Solana devnet preview.";
  if (chain === "base" && env === "testnet") return "Base testnet. Solana devnet preview.";
  return "Live on Base. Solana devnet preview.";
}

export function getOtherSubdomain(): { label: string; href: string } | null {
  const chain = getDeploymentChain();
  if (chain === "base") return { label: "Solana devnet →", href: SOLANA_SUBDOMAIN };
  if (chain === "solana") return { label: "Base (live) →", href: BASE_SUBDOMAIN };
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/__tests__/deployment.test.ts`
Expected: PASS — 17 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deployment.ts src/__tests__/deployment.test.ts
git commit -m "feat(b1n-295): add deployment helper for chain-aware frontend"
```

---

## Task 2: Register TSLAx asset + per-asset fallback spot

**Files:**
- Modify: `src/lib/assets.ts`
- Create: `public/tslax.png` (placeholder — copy from `sol.png` for now)

- [ ] **Step 1: Copy placeholder logo**

Run:
```bash
cp public/sol.png public/tslax.png
```
Expected: `public/tslax.png` exists. (User replaces with real art later.)

- [ ] **Step 2: Modify `src/lib/assets.ts`**

Edit: add `fallbackSpot` to `AssetConfig`, `tslax` entry, and switch `DEFAULT_ASSET` to a getter.

```ts
import { normalizeUsdPrice } from "@/lib/positionMath";

export interface AssetConfig {
  slug: string;
  symbol: string;
  name: string;
  wrappedSymbol: string;
  stableSymbol: string;
  maxAmount: number;
  maxAmountUsd: number;
  amountPlaceholder: string;
  displayDecimals: number;
  comingSoon?: boolean;
  swapFeeTier?: number;
  minSellAmount: number;
  minBuyAmountUsd: number;
  chain: "base" | "solana";
  collateralDecimals: number;
  /** Spot price used when live feed is unavailable (landing hero, loop) */
  fallbackSpot: number;
}

export const ASSETS: Record<string, AssetConfig> = {
  eth: {
    slug: "eth",
    symbol: "ETH",
    name: "Ethereum",
    wrappedSymbol: "WETH",
    stableSymbol: "USDC",
    maxAmount: 1_000,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "0.5",
    displayDecimals: 4,
    swapFeeTier: 3000,
    minSellAmount: 0.005,
    minBuyAmountUsd: 10,
    chain: "base",
    collateralDecimals: 18,
    fallbackSpot: 2621,
  },
  btc: {
    slug: "btc",
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    wrappedSymbol: "cbBTC",
    stableSymbol: "USDC",
    maxAmount: 100,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "0.01",
    displayDecimals: 6,
    swapFeeTier: 500,
    minSellAmount: 0.0001,
    minBuyAmountUsd: 10,
    chain: "base",
    collateralDecimals: 8,
    fallbackSpot: 95_000,
  },
  sol: {
    slug: "sol",
    symbol: "SOL",
    name: "Solana",
    wrappedSymbol: "wSOL",
    stableSymbol: "USDC",
    maxAmount: 10_000,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "10",
    displayDecimals: 4,
    minSellAmount: 0.1,
    minBuyAmountUsd: 10,
    chain: "solana",
    collateralDecimals: 9,
    fallbackSpot: 180,
  },
  tslax: {
    slug: "tslax",
    symbol: "TSLAx",
    name: "Tesla (devnet mock)",
    wrappedSymbol: "TSLAx",
    stableSymbol: "USDC",
    maxAmount: 10_000,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "10",
    displayDecimals: 4,
    minSellAmount: 0.01,
    minBuyAmountUsd: 10,
    chain: "solana",
    collateralDecimals: 8,
    fallbackSpot: 350,
  },
};

export const ASSET_SLUGS = Object.keys(ASSETS);

const DEFAULT_ASSET_FALLBACK = "eth";

/**
 * Default asset slug for /earn and similar routes.
 * Resolved lazily so NEXT_PUBLIC_FEATURED_ASSET can override per deployment.
 */
export function getDefaultAssetSlug(): string {
  const override = process.env.NEXT_PUBLIC_FEATURED_ASSET;
  if (override && override in ASSETS) return override;
  const chain = process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN;
  if (chain === "solana") return "sol";
  return DEFAULT_ASSET_FALLBACK;
}

/** @deprecated Use getDefaultAssetSlug() — kept for call-site compatibility during migration. */
export const DEFAULT_ASSET = DEFAULT_ASSET_FALLBACK;

if (!(DEFAULT_ASSET in ASSETS)) {
  throw new Error(
    `DEFAULT_ASSET "${DEFAULT_ASSET}" not found in ASSETS registry`,
  );
}

export function getAssetConfig(slug: string): AssetConfig | undefined {
  return ASSETS[slug.toLowerCase()];
}

/**
 * Resolve asset config for a position.
 * Uses the backend `asset` field when available, falls back to
 * inferring from strike price (BTC > $10k, ETH below).
 */
export function resolvePositionAsset(
  asset?: string,
  strikePrice?: number,
): AssetConfig {
  if (asset) {
    const config = ASSETS[asset.toLowerCase()];
    if (config) return config;
  }
  if (strikePrice != null) {
    const strikeUsd = normalizeUsdPrice(strikePrice);
    if (strikeUsd > 10_000) return ASSETS.btc;
    if (strikeUsd < 500) return ASSETS.sol;
    return ASSETS.eth;
  }
  return ASSETS[DEFAULT_ASSET_FALLBACK];
}
```

- [ ] **Step 3: Run type check**

Run: `bunx tsc --noEmit`
Expected: PASS (or only pre-existing errors — list any that appeared from this change).

- [ ] **Step 4: Run existing tests**

Run: `bun test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/assets.ts public/tslax.png
git commit -m "feat(b1n-295): register TSLAx asset; add fallbackSpot; default asset getter"
```

---

## Task 3: Solana balance hook — TSLAx support

**Files:**
- Modify: `src/lib/solana.ts`
- Modify: `src/hooks/useSolanaBalance.ts`
- Create: `src/__tests__/useSolanaBalance.test.ts`

- [ ] **Step 1: Add TSLAx mint constant**

Modify `src/lib/solana.ts` — insert after the `SOLANA_USDC_MINT` constant:

```ts
export const SOLANA_TSLAX_MINT = process.env.NEXT_PUBLIC_SOLANA_TSLAX_MINT ?? "";
```

And append a warning parallel to the USDC one:

```ts
if (!SOLANA_TSLAX_MINT) {
  console.warn(
    "[solana] NEXT_PUBLIC_SOLANA_TSLAX_MINT is not set. " +
      "TSLAx balance will always show as zero.",
  );
}
```

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/useSolanaBalance.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/solana", async () => {
  const actual = await vi.importActual<typeof import("@/lib/solana")>("@/lib/solana");
  return {
    ...actual,
    SOLANA_USDC_MINT: "UsdcMint1111111111111111111111111111111111",
    SOLANA_TSLAX_MINT: "TslaxMint11111111111111111111111111111111",
    SOLANA_WSOL_MINT: "So11111111111111111111111111111111111111112",
    solanaConnection: {
      getParsedTokenAccountsByOwner: vi.fn(),
      getBalance: vi.fn().mockResolvedValue(0),
    },
    toPublicKey: (value: string) => ({ toBase58: () => value }),
  };
});

async function importHook() {
  return await import("@/hooks/useSolanaBalance");
}

function mockTokenAccount(rawAmount: string) {
  return {
    value: [
      {
        account: {
          data: { parsed: { info: { tokenAmount: { amount: rawAmount } } } },
        },
      },
    ],
  };
}

describe("useSolanaBalance TSLAx", () => {
  let solana: typeof import("@/lib/solana");

  beforeEach(async () => {
    vi.clearAllMocks();
    solana = await import("@/lib/solana");
  });

  it("reads TSLAx SPL balance alongside USDC and wSOL", async () => {
    const byMint = new Map<string, Awaited<ReturnType<typeof mockTokenAccount>>>([
      ["UsdcMint1111111111111111111111111111111111", mockTokenAccount("1000000")],   // 1 USDC (6 dec)
      ["TslaxMint11111111111111111111111111111111", mockTokenAccount("25000000")],   // 0.25 TSLAx (8 dec)
      ["So11111111111111111111111111111111111111112", mockTokenAccount("0")],
    ]);

    (solana.solanaConnection!.getParsedTokenAccountsByOwner as ReturnType<typeof vi.fn>)
      .mockImplementation(async (_owner, { mint }) => byMint.get(mint.toBase58())!);

    const { useSolanaBalance } = await importHook();
    const { result } = renderHook(() =>
      useSolanaBalance("OwnerAddr111111111111111111111111111111111", 60_000),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.solanaUsdc).toBeCloseTo(1, 9);
    expect(result.current.solanaTslax).toBeCloseTo(0.25, 9);
    expect(result.current.solanaTslaxRaw).toBe(BigInt(25_000_000));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test src/__tests__/useSolanaBalance.test.ts`
Expected: FAIL — `solanaTslax` / `solanaTslaxRaw` undefined on `result.current`.

- [ ] **Step 4: Extend `useSolanaBalance`**

Modify `src/hooks/useSolanaBalance.ts`:

```ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  solanaConnection,
  SOLANA_USDC_MINT,
  SOLANA_TSLAX_MINT,
  SOLANA_WSOL_MINT,
  toPublicKey,
} from "@/lib/solana";

interface SolanaBalance {
  solanaUsdcRaw: bigint;
  solanaUsdc: number;
  solanaTslaxRaw: bigint;
  solanaTslax: number;
  solanaWsolRaw: bigint;
  solanaWsol: number;
  solanaSolRaw: bigint;
  solanaSol: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const ZERO: SolanaBalance = {
  solanaUsdcRaw: BigInt(0),
  solanaUsdc: 0,
  solanaTslaxRaw: BigInt(0),
  solanaTslax: 0,
  solanaWsolRaw: BigInt(0),
  solanaWsol: 0,
  solanaSolRaw: BigInt(0),
  solanaSol: 0,
  loading: true,
  error: null,
  refetch: async () => {},
};

export function useSolanaBalance(
  address: string | undefined,
  pollInterval = 15_000,
): SolanaBalance {
  const [balance, setBalance] = useState<SolanaBalance>(ZERO);
  const requestIdRef = useRef(0);

  const refetch = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!address || !SOLANA_USDC_MINT || !solanaConnection) {
      setBalance({ ...ZERO, loading: false, refetch });
      return;
    }
    try {
      const owner = toPublicKey(address, "wallet address");
      const usdcMint = toPublicKey(SOLANA_USDC_MINT, "USDC mint");
      const wsolMint = toPublicKey(SOLANA_WSOL_MINT, "wSOL mint");
      const tslaxMint = SOLANA_TSLAX_MINT
        ? toPublicKey(SOLANA_TSLAX_MINT, "TSLAx mint")
        : null;

      const [usdcResp, wsolResp, tslaxResp, solLamports] = await Promise.all([
        solanaConnection.getParsedTokenAccountsByOwner(owner, { mint: usdcMint }, "confirmed"),
        solanaConnection.getParsedTokenAccountsByOwner(owner, { mint: wsolMint }, "confirmed"),
        tslaxMint
          ? solanaConnection.getParsedTokenAccountsByOwner(owner, { mint: tslaxMint }, "confirmed")
          : Promise.resolve({ value: [] as Array<never> }),
        solanaConnection.getBalance(owner, "confirmed"),
      ]);

      const sumAmounts = (
        resp: { value: Array<{ account: { data: { parsed?: { info?: { tokenAmount?: { amount?: string } } } } } }> },
      ): bigint => {
        let total = BigInt(0);
        for (const { account } of resp.value) {
          const amt = account.data.parsed?.info?.tokenAmount?.amount;
          if (amt) total += BigInt(amt);
        }
        return total;
      };

      const usdcRaw = sumAmounts(usdcResp);
      const wsolRaw = sumAmounts(wsolResp);
      const tslaxRaw = sumAmounts(tslaxResp);
      const solRaw = BigInt(solLamports);

      if (requestId !== requestIdRef.current) return;

      setBalance({
        solanaUsdcRaw: usdcRaw,
        solanaUsdc: Number(usdcRaw) / 1e6,
        solanaTslaxRaw: tslaxRaw,
        solanaTslax: Number(tslaxRaw) / 1e8,
        solanaWsolRaw: wsolRaw,
        solanaWsol: Number(wsolRaw) / 1e9,
        solanaSolRaw: solRaw,
        solanaSol: Number(solRaw) / 1e9,
        loading: false,
        error: null,
        refetch,
      });
    } catch (err) {
      console.error("[useSolanaBalance] Failed to fetch:", err);
      if (requestId !== requestIdRef.current) return;
      setBalance((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to fetch Solana balance",
        refetch,
      }));
    }
  }, [address]);

  useEffect(() => {
    refetch();
    if (!address) return;
    const id = setInterval(refetch, pollInterval);
    return () => clearInterval(id);
  }, [refetch, address, pollInterval]);

  useEffect(() => {
    const handler = () => {
      refetch();
      for (const delay of [500, 1500, 3000, 6000]) {
        window.setTimeout(() => refetch(), delay);
      }
    };
    window.addEventListener("balance:refetch", handler);
    return () => window.removeEventListener("balance:refetch", handler);
  }, [refetch]);

  return { ...balance, refetch };
}
```

- [ ] **Step 5: Run tests**

Run: `bun test src/__tests__/useSolanaBalance.test.ts`
Expected: PASS.

Run full suite: `bun test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/solana.ts src/hooks/useSolanaBalance.ts src/__tests__/useSolanaBalance.test.ts
git commit -m "feat(b1n-295): read TSLAx SPL balance on Solana"
```

---

## Task 4: Devnet banner component

**Files:**
- Create: `src/components/DevnetBanner.tsx`
- Create: `src/__tests__/DevnetBanner.test.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/DevnetBanner.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("@/lib/deployment", () => ({
  isDevnet: vi.fn(),
}));

async function importBanner() {
  return await import("@/components/DevnetBanner");
}

describe("DevnetBanner", () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("renders nothing when not devnet", async () => {
    const { isDevnet } = await import("@/lib/deployment");
    (isDevnet as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const { DevnetBanner } = await importBanner();
    const { container } = render(<DevnetBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders devnet message when devnet", async () => {
    const { isDevnet } = await import("@/lib/deployment");
    (isDevnet as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const { DevnetBanner } = await importBanner();
    render(<DevnetBanner />);
    expect(
      screen.getByText(/Devnet preview/i),
    ).toBeInTheDocument();
  });

  it("persists dismissal in sessionStorage", async () => {
    const { isDevnet } = await import("@/lib/deployment");
    (isDevnet as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const { DevnetBanner } = await importBanner();
    const { container } = render(<DevnetBanner />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(container.firstChild).toBeNull();
    expect(sessionStorage.getItem("b1nary:devnet-banner-dismissed")).toBe("1");
  });

  it("stays dismissed when sessionStorage flag is set", async () => {
    sessionStorage.setItem("b1nary:devnet-banner-dismissed", "1");
    const { isDevnet } = await import("@/lib/deployment");
    (isDevnet as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const { DevnetBanner } = await importBanner();
    const { container } = render(<DevnetBanner />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/DevnetBanner.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Create `src/components/DevnetBanner.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { isDevnet } from "@/lib/deployment";

const STORAGE_KEY = "b1nary:devnet-banner-dismissed";

export function DevnetBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isDevnet()) return;
    if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="relative z-40 w-full bg-[var(--accent)]/10 border-b border-[var(--accent)]/30 px-4 py-2 text-center text-xs sm:text-sm text-[var(--bone)]"
    >
      <span className="font-semibold text-[var(--accent)] mr-2">Devnet preview</span>
      Mock assets, no real funds. Positions here do not reflect mainnet.
      <button
        aria-label="Dismiss devnet banner"
        onClick={() => {
          sessionStorage.setItem(STORAGE_KEY, "1");
          setVisible(false);
        }}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text)] text-base leading-none"
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Mount banner in root layout**

Modify `src/app/layout.tsx` `<body>`:

```tsx
import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DevnetBanner } from "@/components/DevnetBanner";
import "./globals.css";

// ... existing metadata block unchanged ...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="base:app_id" content="69a5b7c877bc7576330f4b09" />
      </head>
      <body>
        <Providers>
          <TooltipProvider>
            <DevnetBanner />
            {children}
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Run tests**

Run: `bun test src/__tests__/DevnetBanner.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/DevnetBanner.tsx src/__tests__/DevnetBanner.test.tsx src/app/layout.tsx
git commit -m "feat(b1n-295): add dismissible devnet banner"
```

---

## Task 5: Earn index redirect uses featured asset

**Files:**
- Modify: `src/app/earn/page.tsx`

- [ ] **Step 1: Update redirect**

Replace file contents with:

```tsx
import { redirect } from "next/navigation";
import { getFeaturedAssetSlug } from "@/lib/deployment";

export default function EarnPage() {
  redirect(`/earn/${getFeaturedAssetSlug()}`);
}
```

- [ ] **Step 2: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/earn/page.tsx
git commit -m "feat(b1n-295): /earn redirect honors featured asset"
```

---

## Task 6: Asset selector — filter by deployment chain + TSLAx logo

**Files:**
- Modify: `src/components/v2/AssetSelector.tsx`

- [ ] **Step 1: Add TSLAx logo entry + chain filter**

Edit the imports and top section of `src/components/v2/AssetSelector.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import Image from "next/image";
import { ASSETS, ASSET_SLUGS, type AssetConfig } from "@/lib/assets";
import { getDeploymentChain } from "@/lib/deployment";

const ASSET_LOGOS: Record<string, string> = {
  eth: "/eth.png",
  btc: "/cbbtc.webp",
  sol: "/sol.png",
  tslax: "/tslax.png",
};
```

Note: `Check` import was removed — verify the only remaining lucide-react use is `ChevronsUpDown`.

Then replace the selector list-render:

```tsx
<CommandGroup>
  {ASSET_SLUGS.filter((slug) => {
    const chain = getDeploymentChain();
    if (chain === "multi") return true;
    return ASSETS[slug].chain === chain;
  }).map((slug) => {
    const asset = ASSETS[slug];
    const isActive = slug === current.slug;
    const disabled = asset.comingSoon === true;
    return (
      <CommandItem
        key={slug}
        value={`${asset.symbol} ${asset.name}`}
        disabled={disabled}
        onSelect={() => {
          if (disabled) return;
          if (!isActive) {
            router.push(`/earn/${slug}`);
          }
          setOpen(false);
        }}
        className={`flex items-center gap-2.5 px-3 py-2.5
          text-[var(--text)]
          data-[selected=true]:bg-[var(--surface)]
          data-[selected=true]:text-[var(--text)]
          ${disabled ? "opacity-50 cursor-default" : "cursor-pointer"}`}
      >
        <AssetIcon slug={slug} size={18} />
        <span className="font-medium">{asset.symbol}</span>
        <span className="text-xs text-[var(--text-secondary)]">
          {asset.name}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {asset.chain === "base" && (
            <span className="text-[9px] font-medium text-blue-400
              bg-blue-500/10 px-1 py-0.5 rounded">
              Base
            </span>
          )}
          {asset.chain === "solana" && (
            <span className="text-[9px] font-medium text-purple-400
              bg-purple-500/10 px-1 py-0.5 rounded">
              Solana
            </span>
          )}
          {disabled && (
            <span className="text-[10px] font-medium
              text-[var(--text-secondary)] border
              border-[var(--border)] rounded px-1.5 py-0.5">
              Soon
            </span>
          )}
        </span>
      </CommandItem>
    );
  })}
</CommandGroup>
```

- [ ] **Step 2: Type check + tests**

Run: `bunx tsc --noEmit && bun test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/v2/AssetSelector.tsx
git commit -m "feat(b1n-295): filter asset selector by deployment chain; add TSLAx logo"
```

---

## Task 7: Landing — asset-agnostic symbols in hero / mechanism / loop / comparison / terminal

**Files:**
- Modify: `src/components/landing/LandingPage.tsx`

This task rewrites the hardcoded "ETH" strings so the featured asset, chain label, hero line, and cross-subdomain link come from the deployment helper. Long but mostly mechanical — follow the blocks below exactly.

- [ ] **Step 1: Update imports + top-level resolution**

At the top of `src/components/landing/LandingPage.tsx`, replace the existing imports + `FALLBACK_SPOT` block with:

```tsx
"use client";

import Link from "next/link";
import { useRef, useState, useCallback, useEffect, useMemo, memo } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { BackgroundEffects } from "./BackgroundEffects";
import { usePrices } from "@/hooks/usePrices";
import { useSpot } from "@/hooks/useSpot";
import { ASSETS, type AssetConfig } from "@/lib/assets";
import {
  getFeaturedAssetSlug,
  getChainLabel,
  getHeroChainLine,
  getOtherSubdomain,
} from "@/lib/deployment";

const WORDMARK_FONT = "'Fira Code', monospace";
const TARGET = "b1nary";
const BINARY_CHARS = "01";
```

Remove the `FALLBACK_SPOT = 2621` constant.

- [ ] **Step 2: Rewrite `HeroSection` to take featured asset + chain strings**

Replace the `HeroSection` function (lines ~172-249 in current file) with:

```tsx
function HeroSection({
  featured,
  heroChainLine,
  launchHref,
}: {
  featured: AssetConfig;
  heroChainLine: string;
  launchHref: string;
}) {
  return (
    <section className="min-h-screen flex flex-col justify-center px-6 relative z-[3]">
      <div className="max-w-5xl mx-auto w-full">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-[clamp(2.2rem,6vw,4.5rem)] leading-[1.05] tracking-tight text-[var(--bone)] font-light"
        >
          Turn volatility into income.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="mt-4 text-[clamp(1.3rem,3.5vw,2rem)] leading-[1.2] text-[var(--text-secondary)] font-light"
        >
          You set the terms. The market moves. You already know the outcome.
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.0 }}
          className="mt-8 font-mono text-[clamp(0.75rem,1.2vw,0.85rem)] text-[var(--accent)] tracking-[0.15em] uppercase"
        >
          humans use the app{" "}
          <span className="text-[var(--text-secondary)] opacity-40 mx-1">/</span>{" "}
          agents use the API{" "}
          <span className="text-[var(--text-secondary)] opacity-40 mx-1">/</span>{" "}
          one protocol
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.15 }}
          className="mt-4 text-sm text-[var(--text-secondary)]"
        >
          {heroChainLine}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.3 }}
          className="flex flex-wrap gap-4 mt-12 items-center"
        >
          <div className="flex flex-col items-start gap-1.5">
            <Link
              href={launchHref}
              className="rounded-xl px-8 py-3.5 text-base font-semibold bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
            >
              Launch App
            </Link>
            <span className="text-xs text-[var(--text-secondary)] opacity-70 font-mono">
              opens with {featured.symbol}
            </span>
          </div>
          <a
            href="#mechanism"
            className="rounded-xl px-8 py-3.5 text-base font-medium text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--text-secondary)] transition-colors"
          >
            See how it works &darr;
          </a>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 2 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <motion.span
          animate={{ y: [-6, 6, -6] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="text-[var(--text-secondary)] text-2xl block"
        >
          &darr;
        </motion.span>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 3: Rewrite `SideToggle` to use symbol**

Replace `SideToggle` (the "I have USD" / "I have ETH" block):

```tsx
function SideToggle({
  side,
  onSideChange,
  symbol,
}: {
  side: "buy" | "sell";
  onSideChange: (s: "buy" | "sell") => void;
  symbol: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 flex w-fit">
      <button
        onClick={() => onSideChange("buy")}
        className={`px-5 py-3 text-sm font-medium rounded-lg transition-all ${
          side === "buy"
            ? "bg-[var(--border)] text-[var(--accent)] shadow-sm"
            : "text-[var(--text-secondary)] hover:text-[var(--text)]"
        }`}
      >
        I have USD
      </button>
      <button
        onClick={() => onSideChange("sell")}
        className={`px-5 py-3 text-sm font-medium rounded-lg transition-all ${
          side === "sell"
            ? "bg-[var(--border)] text-[var(--accent)] shadow-sm"
            : "text-[var(--text-secondary)] hover:text-[var(--text)]"
        }`}
      >
        I have {symbol}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Update `MechanismSection`**

Replace the `MechanismSection` function. Keep premise identical; swap hardcoded "ETH" for `symbol`:

```tsx
function MechanismSection({
  side,
  onSideChange,
  spot,
  buyStrike,
  sellStrike,
  priceReady,
  featured,
}: {
  side: "buy" | "sell";
  onSideChange: (s: "buy" | "sell") => void;
  spot: number;
  buyStrike: number;
  sellStrike: number;
  priceReady: boolean;
  featured: AssetConfig;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const strike = side === "buy" ? buyStrike : sellStrike;
  const premium = derivePremium(spot, side, buyStrike, sellStrike);
  const symbol = featured.symbol;

  return (
    <section id="mechanism" ref={ref} className="min-h-screen flex items-center justify-center px-6 relative z-[3]">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="space-y-8">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            className="text-[clamp(2rem,5vw,3.5rem)] font-light text-[var(--bone)] tracking-tight"
          >
            Here&apos;s how it works.
          </motion.h2>

          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="space-y-5"
          >
            <div className="flex items-center gap-6 flex-wrap">
              <p className="text-[var(--text-secondary)] text-lg">
                {symbol} is{" "}
                {priceReady ? (
                  <span className="text-[var(--text)] font-bold font-mono">${spot.toLocaleString()}</span>
                ) : (
                  <span className="inline-block w-20 h-6 rounded bg-[var(--border)] animate-pulse align-middle" />
                )}
              </p>
              <SideToggle side={side} onSideChange={onSideChange} symbol={symbol} />
            </div>

            <AnimatePresence mode="wait">
              <motion.p
                key={side}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-xl text-[var(--text-secondary)]"
              >
                You set: <span className="text-[var(--text)]">{side === "buy" ? "Buy" : "Sell"} {symbol} at ${strike.toLocaleString()}</span>
                <br />
                You receive: <span className="font-semibold text-[var(--accent)]"><AnimatedPremium value={premium} /></span> upfront
              </motion.p>
            </AnimatePresence>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-[var(--text-secondary)] opacity-60 text-sm"
          >
            Locked until expiry. Only the closing price matters.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="pt-4 border-t border-[var(--border)] space-y-2"
          >
            <p className="text-sm text-[var(--text-secondary)] uppercase tracking-wider">
              Where does the money come from?
            </p>
            <p className="text-[var(--text-secondary)]">
              You set a price, someone pays to lock it in. You get paid upfront, every time.
            </p>
            <p className="text-sm font-medium text-[var(--accent)]">
              Not token rewards. Real market income.
            </p>
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={side}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 p-5 sm:p-8 space-y-6"
          >
            <div className="space-y-1">
              <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">Price {side === "buy" ? "drops" : "rises"}</p>
              <p className="text-xl text-[var(--text)] font-light">
                {side === "buy"
                  ? `You buy ${symbol} at $${strike.toLocaleString()}.`
                  : `You sell ${symbol} at $${strike.toLocaleString()}.`}
              </p>
              <p className="text-[var(--text-secondary)]">
                + keep the <span className="font-semibold text-[var(--accent)]">${premium}</span>
              </p>
            </div>

            <div className="border-t border-[var(--border)]" />

            <div className="space-y-1">
              <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">It {side === "buy" ? "doesn't drop" : "doesn't rise"}</p>
              <p className="text-xl text-[var(--text)] font-light">
                {side === "buy"
                  ? `Your $${strike.toLocaleString()} comes back.`
                  : `Your ${symbol} comes back.`}
              </p>
              <p className="text-[var(--text-secondary)]">
                + keep the <span className="font-semibold text-[var(--accent)]">${premium}</span>
              </p>
            </div>

            <div className="border-t border-[var(--border)]" />

            <p className="text-lg font-medium text-[var(--accent)]">
              Either way: +${premium} earned.
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Update `buildLoopFrames` + `LoopSection` to take `symbol`**

Replace both functions. `buildLoopFrames` gains a `symbol` parameter at the end; `LoopSection` takes `featured` and passes `featured.symbol`:

```tsx
function buildLoopFrames(
  side: "buy" | "sell",
  buyStrike: number,
  sellStrike: number,
  buyPremium: number,
  sellPremium: number,
  symbol: string,
): LoopFrame[] {
  const bs = `$${buyStrike.toLocaleString()}`;
  const ss = `$${sellStrike.toLocaleString()}`;
  const bp = buyPremium;
  const sp = sellPremium;

  if (side === "buy") return [
    { text: `Buy ${symbol} @ ${bs}` },
    { text: `Earn $${bp} ✓`, accent: true, counter: bp },
    { text: `Price didn't hit.\n${bs} back.`, secondary: true },
    { text: "Earn again →", accent: true, pulse: true },
    { text: `Buy ${symbol} @ ${bs}` },
    { text: `Earn $${bp} ✓`, accent: true, counter: bp },
    { text: `Price hit.\nYou bought ${symbol} @ ${bs}.`, secondary: true },
    { text: `You now have ${symbol}.\nSet a sell price.`, slow: true },
    { text: `Sell ${symbol} @ ${ss}` },
    { text: `Earn $${sp} ✓`, accent: true, counter: sp },
    { text: "Earn again →", accent: true, pulse: true },
  ];

  return [
    { text: `Sell ${symbol} @ ${ss}` },
    { text: `Earn $${sp} ✓`, accent: true, counter: sp },
    { text: `Price didn't hit.\nYour ${symbol} comes back.`, secondary: true },
    { text: "Earn again →", accent: true, pulse: true },
    { text: `Sell ${symbol} @ ${ss}` },
    { text: `Earn $${sp} ✓`, accent: true, counter: sp },
    { text: `Price hit.\nYou sold ${symbol} @ ${ss}.`, secondary: true },
    { text: "You now have dollars.\nSet a buy price.", slow: true },
    { text: `Buy ${symbol} @ ${bs}` },
    { text: `Earn $${bp} ✓`, accent: true, counter: bp },
    { text: "Earn again →", accent: true, pulse: true },
  ];
}

const LoopSection = memo(function LoopSection({
  side,
  buyStrike,
  sellStrike,
  spotBase,
  featured,
}: {
  side: "buy" | "sell";
  buyStrike: number;
  sellStrike: number;
  spotBase: number;
  featured: AssetConfig;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });
  const [frameIndex, setFrameIndex] = useState(0);
  const buyPremium = derivePremium(spotBase, "buy", buyStrike, sellStrike);
  const sellPremium = derivePremium(spotBase, "sell", buyStrike, sellStrike);
  const frames = useMemo(
    () => buildLoopFrames(side, buyStrike, sellStrike, buyPremium, sellPremium, featured.symbol),
    [side, buyStrike, sellStrike, buyPremium, sellPremium, featured.symbol],
  );

  useEffect(() => { setFrameIndex(0); }, [side]);

  useEffect(() => {
    if (!inView) return;
    const duration = frames[frameIndex]?.slow ? 2500 : 2000;
    const timer = setTimeout(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, duration);
    return () => clearTimeout(timer);
  }, [inView, frameIndex, frames]);

  const frame = frames[frameIndex];

  return (
    <section ref={ref} className="min-h-screen flex items-center justify-center px-6 relative z-[3]">
      <div className="max-w-5xl w-full space-y-12">
        <FadeBlock>
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-light text-[var(--bone)] tracking-tight">
            Every outcome earns.
          </h2>
        </FadeBlock>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 p-5 sm:p-10 min-h-[160px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${side}-${frameIndex}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="text-center space-y-1"
            >
              {frame.text.split("\n").map((line, i) => (
                <p
                  key={i}
                  className={`text-[clamp(1.3rem,3.5vw,2.2rem)] leading-relaxed ${
                    frame.accent
                      ? "font-semibold text-[var(--accent)]"
                      : frame.secondary
                        ? "text-[var(--text-secondary)] font-light"
                        : "text-[var(--text)] font-light"
                  }`}
                >
                  {frame.counter && i === 0 ? (
                    <>Earn <LoopCounter target={frame.counter} /> {"✓"}</>
                  ) : frame.pulse ? (
                    <motion.span
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {line}
                    </motion.span>
                  ) : (
                    line
                  )}
                </p>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <FadeBlock delay={0.2}>
          <p className="text-center text-[var(--text-secondary)] text-lg">
            Real earnings. Paid upfront. Every cycle.
          </p>
        </FadeBlock>
      </div>
    </section>
  );
});
```

- [ ] **Step 6: Update `ComparisonSection` for chain + symbol**

Replace `COMPARISONS` constant + `ComparisonSection`:

```tsx
function buildComparisons(featured: AssetConfig) {
  const stakingName = `Staking ${featured.symbol}`;
  const lendingName = featured.chain === "solana" ? "Lending (Kamino)" : "Lending (Aave)";
  return [
    { name: "Savings account", apr: "~4%", pros: ["Safe"], cons: ["Not crypto"] },
    { name: stakingName, apr: "~3.5%", pros: ["Passive"], cons: ["Low income"] },
    { name: lendingName, apr: "~2%", pros: ["DeFi"], cons: ["Lower income"] },
  ];
}

const ComparisonSection = memo(function ComparisonSection({ featured }: { featured: AssetConfig }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });
  const rows = useMemo(() => buildComparisons(featured), [featured]);

  return (
    <section ref={ref} className="min-h-screen flex items-center justify-center px-6 relative z-[3]">
      <div className="max-w-5xl w-full space-y-12">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(2rem,5vw,3.5rem)] font-light text-[var(--bone)] tracking-tight"
        >
          How does this compare?
        </motion.h2>

        <div className="space-y-3">
          {rows.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 15 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
              className="flex items-center justify-between py-4 border-b border-[var(--border)]"
            >
              <span className="text-[var(--text-secondary)] text-base sm:text-lg">{item.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-[var(--text-secondary)] text-base sm:text-lg font-light">{item.apr}</span>
                <div className="hidden sm:flex items-center gap-2 text-sm">
                  {item.pros.map((p) => (
                    <span key={p} className="text-[var(--text-secondary)] opacity-60">{"✓"} {p}</span>
                  ))}
                  {item.cons.map((c) => (
                    <span key={c} className="text-[var(--text-secondary)] opacity-50">{"✗"} {c}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex items-center justify-between py-5 rounded-xl px-4 -mx-4 bg-[var(--accent)]/6 border-b border-[var(--accent)]/15"
          >
            <span className="text-[var(--bone)] text-base sm:text-lg font-medium font-mono">b<span className="text-[var(--accent)]">1</span>nary</span>
            <div className="flex items-center gap-4">
              <span className="text-lg sm:text-xl font-semibold text-[var(--accent)]">15–60%</span>
              <div className="hidden sm:flex items-center gap-2 text-sm text-[var(--accent)]">
                <span>{"✓"} Passive</span>
                <span>{"✓"} Paid upfront</span>
                <span>{"✓"} Keep your crypto</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
});
```

- [ ] **Step 7: Update `AgentNativeSection` terminal examples**

Replace `AgentNativeSection` to take `featured` and use symbol + strike from `fallbackSpot`:

```tsx
function AgentNativeSection({ featured }: { featured: AssetConfig }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const symbol = featured.symbol;
  const sampleStrike = Math.round(featured.fallbackSpot * 1.08 / 10) * 10;

  return (
    <section ref={ref} className="py-24 px-6 relative z-[3]">
      <div className="max-w-6xl mx-auto space-y-12">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(2rem,5vw,3.5rem)] font-light text-[var(--bone)] tracking-tight leading-[1.1]"
        >
          Same protocol. Any interface.
        </motion.h2>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
          >
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[var(--border)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-secondary)] opacity-30" />
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-secondary)] opacity-30" />
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-secondary)] opacity-30" />
            </div>

            <div className="px-5 sm:px-6 py-6 font-mono text-[clamp(0.75rem,1.3vw,0.9rem)] leading-relaxed space-y-4 overflow-x-auto scrollbar-hide">
              <motion.div
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <p className="text-[var(--text-secondary)]">
                  <span className="text-[var(--accent)]">$</span> human clicks &quot;Sell {symbol} at ${sampleStrike.toLocaleString()}&quot;
                </p>
                <p className="text-[var(--accent)] mt-1">&gt; +$62 earned</p>
              </motion.div>

              <motion.div
                initial={{ scaleX: 0 }}
                animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
                className="border-t border-[var(--border)] origin-left"
              />

              <motion.div
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <p className="text-[var(--text-secondary)]">
                  <span className="text-[var(--accent)]">$</span> agent POST /execute &#123;asset: &quot;{symbol}&quot;, price: {sampleStrike}, side: &quot;sell&quot;&#125;
                </p>
                <p className="text-[var(--accent)] mt-1">&gt; +$62 earned</p>
              </motion.div>

              <motion.div
                initial={{ scaleX: 0 }}
                animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
                transition={{ duration: 0.4, delay: 0.85 }}
                className="border-t border-[var(--border)] origin-left"
              />

              <motion.div
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.4, delay: 1.0 }}
              >
                <p className="text-[var(--text-secondary)]">
                  <span className="text-[var(--accent)]">$</span> agent POST /provide &#123;asset: &quot;{symbol}&quot;, quotes: [...]&#125;
                </p>
                <p className="text-[var(--accent)] mt-1">&gt; Liquidity published. Earning fees on every trade.</p>
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="lg:col-span-2 space-y-4"
          >
            <p className="text-[clamp(1.3rem,2.5vw,1.8rem)] text-[var(--bone)] font-light leading-snug">
              Trade or provide liquidity.
              <br />
              Human or agent.
            </p>
            <p className="text-[var(--text-secondary)] opacity-60 text-base">
              Every side of the protocol, open to both.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 8: Update `SocialProofSection` to use chain label**

Replace `STATS` and `SocialProofSection`:

```tsx
const SocialProofSection = memo(function SocialProofSection({ chainLabel }: { chainLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });
  const stats = [
    { label: "Built on", value: chainLabel },
    { label: "Backed", value: "100%" },
    { label: "Margin calls", value: "None" },
  ];

  return (
    <section ref={ref} className="py-24 flex items-center justify-center px-6 relative z-[3]">
      <div className="max-w-5xl w-full space-y-12">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-[clamp(1.5rem,4vw,2.5rem)] font-light text-[var(--text)] tracking-tight text-center"
        >
          Fully collateralized. No margin. No liquidations.
        </motion.h2>

        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
              className="text-center"
            >
              <p className="text-xl sm:text-3xl font-semibold text-[var(--bone)] font-mono">{stat.value}</p>
              <p className="text-sm text-[var(--text-secondary)] opacity-60 mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="text-center text-[var(--text-secondary)] opacity-50 text-sm"
        >
          Open source · Audited · Live on {chainLabel}
        </motion.p>
      </div>
    </section>
  );
});
```

- [ ] **Step 9: Update `CTASection` launch href**

Replace `CTASection`:

```tsx
function CTASection({ launchHref }: { launchHref: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  return (
    <section ref={ref} className="min-h-[70vh] flex items-center justify-center px-6 relative z-[3]">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8 }}
        className="max-w-5xl w-full text-center space-y-10"
      >
        <h2 className="text-[clamp(2.5rem,8vw,6rem)] text-[var(--bone)] leading-[0.95] tracking-tight font-light">
          Set your price.
          <br />
          Get paid.
        </h2>

        <Link
          href={launchHref}
          className="inline-block rounded-xl px-10 py-4 text-base font-semibold bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          Start earning &rarr;
        </Link>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 10: Wire header cross-subdomain link + rewire `LandingPage` orchestration**

Replace the `LandingPage` function's body (the main export at the bottom of the file):

```tsx
export function LandingPage() {
  const featuredSlug = getFeaturedAssetSlug();
  const featured = ASSETS[featuredSlug];
  const chainLabel = getChainLabel();
  const heroChainLine = getHeroChainLine();
  const otherSubdomain = getOtherSubdomain();
  const launchHref = `/earn/${featuredSlug}`;

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const { prices, loading: priceLoading } = usePrices(featuredSlug, 30_000);
  const { spot: liveSpot, loading: spotLoading } = useSpot(featuredSlug, 30_000);
  const quoteSpot = prices[0]?.spot;
  const spot = liveSpot ? Math.round(liveSpot) : quoteSpot ? Math.round(quoteSpot) : featured.fallbackSpot;
  const priceReady = spot !== featured.fallbackSpot || (!priceLoading && !spotLoading);
  const { buyStrike, sellStrike } = useMemo(() => deriveStrikes(spot), [spot]);

  return (
    <div className="bg-[var(--bg)] relative overflow-hidden">
      <BackgroundEffects />

      <header className="fixed top-0 left-0 right-0 z-50 px-6 sm:px-10 lg:px-16 py-5 flex items-center justify-between">
        <HeaderLogo />
        <div className="flex items-center gap-3 sm:gap-4">
          {otherSubdomain && (
            <a
              href={otherSubdomain.href}
              className="hidden sm:inline-flex items-center rounded-lg px-3 py-2 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors"
            >
              {otherSubdomain.label}
            </a>
          )}
          <a
            href="https://docs.b1nary.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center py-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
          >
            Docs
          </a>
          <a
            href="https://x.com/b1naryapp"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="b1nary on X"
            className="p-2.5 text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </a>
          <Link
            href={launchHref}
            className="rounded-lg px-4 py-3 text-sm font-medium border text-[var(--accent)] border-[var(--accent)]/30 hover:border-[var(--accent)]/60 transition-all"
          >
            Launch App &rarr;
          </Link>
        </div>
      </header>

      <main>
        <HeroSection featured={featured} heroChainLine={heroChainLine} launchHref={launchHref} />
        <div className="max-w-6xl mx-auto px-6"><div className="border-t border-[var(--border)]/50" /></div>
        <ProblemSection />
        <EngineSection />
        <MechanismSection
          side={side}
          onSideChange={setSide}
          spot={spot}
          buyStrike={buyStrike}
          sellStrike={sellStrike}
          priceReady={priceReady}
          featured={featured}
        />
        <LoopSection side={side} buyStrike={buyStrike} sellStrike={sellStrike} spotBase={spot} featured={featured} />
        <ComparisonSection featured={featured} />
        <AgentNativeSection featured={featured} />
        <SocialProofSection chainLabel={chainLabel} />
        <CTASection launchHref={launchHref} />
        <AiCtaSection />
      </main>

      <footer className="relative z-[3] border-t border-[var(--border)] px-6 py-8 flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)] opacity-50 font-mono">
          © {new Date().getFullYear()} b1nary
        </span>
        <div className="flex items-center gap-4">
          <a
            href="https://docs.b1nary.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--text-secondary)] opacity-50 hover:opacity-100 transition-opacity"
          >
            Docs
          </a>
          <a
            href="https://x.com/b1naryapp"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="b1nary on X"
            className="text-[var(--text-secondary)] opacity-50 hover:opacity-100 transition-opacity"
          >
            <XIcon className="w-4 h-4" />
          </a>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 11: Remove now-unused `BackgroundEffects` ETH-specific tile (optional)**

`src/components/landing/BackgroundEffects.tsx` has `"ETH"` tokens in its background grid. These are stylistic; leave as-is unless visually jarring on the Solana deploy. If you do want to update, replace the `"ETH"` literal with `"SOL"` and `"TSLA"` mixed into the token list — but only if time permits. **Default: skip.**

- [ ] **Step 12: Type check + tests + visual**

Run: `bunx tsc --noEmit && bun test`
Expected: PASS.

Run dev server: `bun dev`, open `http://localhost:3000`. Verify:
- Hero renders with "ETH" symbol in side toggle and mechanism (default multi deploy uses ETH)
- Chain line says "Live on Base. Solana devnet preview."
- SocialProof "Built on" reads `Base + Solana`
- Launch App → `/earn/eth`

Re-run with Solana env:
```bash
NEXT_PUBLIC_DEPLOYMENT_CHAIN=solana NEXT_PUBLIC_DEPLOYMENT_ENV=devnet bun dev
```
Verify:
- Hero symbol is "SOL"
- Chain line says "Solana devnet preview. Base mainnet live."
- SocialProof "Built on" reads `Solana`
- DevnetBanner visible at the top
- Launch App → `/earn/sol`
- Cross-subdomain pill in header shows "Base (live) →"

- [ ] **Step 13: Commit**

```bash
git add src/components/landing/LandingPage.tsx
git commit -m "feat(b1n-295): multi-chain landing with featured asset and chain label"
```

---

## Task 8: Update root metadata for multi-chain

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update `description` + `openGraph.description` + `twitter.description`**

In `src/app/layout.tsx` metadata, replace "Live on Base." → "Live on Base. Solana devnet preview." in all three description fields. Keep the title unchanged.

Exact new text:
`"Set your price on any asset. Get paid upfront. The volatility protocol for humans and AI agents. Live on Base. Solana devnet preview."`

- [ ] **Step 2: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "chore(b1n-295): update site metadata for multi-chain copy"
```

---

## Task 9: Earn flow copy sweep — asset-aware strings

Scope: update hardcoded "ETH" default params and user-facing copy that assumed Base/ETH. Variable names, comments, and tests untouched.

**Files:**
- Modify: `src/components/AcceptModal.tsx`
- Modify: `src/components/v2/RangeAcceptModal.tsx`
- Modify: `src/components/v2/OutcomeCards.tsx`
- Modify: `src/components/v2/RangeOutcomeCards.tsx`
- Modify: `src/components/PositionCard.tsx`
- Modify: `src/components/RangePositionCard.tsx`
- Modify: `src/components/v2/PayoffDiagram.tsx`
- Modify: `src/components/yield/YieldExplainer.tsx`

- [ ] **Step 1: `PayoffDiagram.tsx` — asset-aware label**

Add `assetSymbol?: string` prop (default `"ETH"`), then replace the hardcoded label:

```tsx
{side === "buy" ? `Buy ${assetSymbol}` : `Sell ${assetSymbol}`}
```

Find the component's props interface in the file, add `assetSymbol?: string`, and destructure it with default `"ETH"` in the function signature. Update every call site of `PayoffDiagram` in the repo to pass `assetSymbol={asset.symbol}` when an asset is in scope. Grep to confirm:

```bash
rg "<PayoffDiagram" src/
```

- [ ] **Step 2: `YieldExplainer.tsx` — de-base-specific copy**

Replace the current text: `"While your position is open, your collateral is deposited in Aave V3 on Base and earns yield automatically. Yield is distributed weekly every Monday via airdrop to your wallet."`

With a chain-aware version. Accept a `chain?: "base" | "solana"` prop defaulting to `"base"`:

```tsx
"use client";

import { InfoTooltip } from "@/components/ui/InfoTooltip";

export function YieldExplainer({ chain = "base" }: { chain?: "base" | "solana" }) {
  const protocol = chain === "solana" ? "Kamino" : "Aave V3";
  const chainLabel = chain === "solana" ? "Solana" : "Base";
  return (
    <InfoTooltip
      title={`${protocol} Yield`}
      text={`While your position is open, your collateral is deposited in ${protocol} on ${chainLabel} and earns yield automatically. Yield is distributed weekly every Monday via airdrop to your wallet.`}
    />
  );
}
```

Update every `<YieldExplainer />` call site to pass `chain={asset.chain}` (grep: `rg "<YieldExplainer" src/`). For AcceptModal, thread through: `<YieldExplainer chain={assetConfig?.chain ?? "base"} />`.

- [ ] **Step 3: `RangeAcceptModal.tsx` — swap label copy**

Find the line at approx. line 108:
```ts
"swapping": "Swapping USDC to ETH...",
```

Replace with:
```ts
"swapping": `Swapping USDC to ${assetSymbol}...`,
```

This requires moving the object declaration inside the component (so `assetSymbol` is in scope). Inspect the surrounding context — if `STEP_LABELS` is a module-level const, turn it into a function `buildStepLabels(assetSymbol: string)` called inside the component.

Also at approx. line 377:
```ts
setError("Lower side failed, but the swap already completed. Your ETH is in your wallet. Please try again.");
```

Replace with:
```ts
setError(`Lower side failed, but the swap already completed. Your ${assetSymbol} is in your wallet. Please try again.`);
```

- [ ] **Step 4: `OutcomeCards.tsx` + `RangeOutcomeCards.tsx` — default assetSymbol stays "ETH"**

These already take `assetSymbol` as a prop with `"ETH"` default. Leave defaults — call sites pass `asset.symbol`. Audit call sites with `rg "assetSymbol=" src/components/v2/` and confirm all pass real symbols; none rely on the default. If any do, fix those sites to pass the prop.

- [ ] **Step 5: `PositionCard.tsx` / `RangePositionCard.tsx` — same pattern**

Same pattern as Step 4. Defaults are fine; audit call sites to ensure they pass `assetSymbol={cfg.symbol}` where `cfg = resolvePositionAsset(...)` is in scope. No code changes unless an audit reveals a missing prop.

- [ ] **Step 6: `AcceptModal.tsx` — internal comments/defaults**

Variable comments like `// ETH calls: accept native ETH + WETH combined` refer to code behavior; do not touch. The user-facing default `assetSymbol = "ETH"` in the props stays — every call site passes an explicit value already (verify via `rg "<AcceptModal" src/`). No copy changes needed.

- [ ] **Step 7: Type check + tests**

Run: `bunx tsc --noEmit && bun test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/AcceptModal.tsx \
        src/components/v2/RangeAcceptModal.tsx \
        src/components/v2/OutcomeCards.tsx \
        src/components/v2/RangeOutcomeCards.tsx \
        src/components/PositionCard.tsx \
        src/components/RangePositionCard.tsx \
        src/components/v2/PayoffDiagram.tsx \
        src/components/yield/YieldExplainer.tsx
git commit -m "feat(b1n-295): asset-aware copy in earn flow components"
```

---

## Task 10: `.env.example` documentation

**Files:**
- Modify: `frontend/.env.example`

- [ ] **Step 1: Append new block**

Append to `.env.example` (keep existing content untouched):

```
# ── Multi-chain deployment switches (B1N-295) ──
# Chain this deployment highlights. base | solana | multi (default multi)
NEXT_PUBLIC_DEPLOYMENT_CHAIN=multi

# Environment type — drives devnet banner + hero copy. mainnet | testnet | devnet
NEXT_PUBLIC_DEPLOYMENT_ENV=mainnet

# Override featured asset independently of deployment chain. Optional.
# Must match a key in src/lib/assets.ts (eth, btc, sol, tslax).
NEXT_PUBLIC_FEATURED_ASSET=

# Solana mock TSLAx mint (devnet only)
NEXT_PUBLIC_SOLANA_TSLAX_MINT=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(b1n-295): document new deployment env vars"
```

---

## Task 11: Post-implementation verification

- [ ] **Step 1: Full type check**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Full test suite**

Run: `bun test`
Expected: PASS.

- [ ] **Step 3: Build check**

Run: `bun run build`
Expected: clean Next.js build with no errors.

- [ ] **Step 4: Manual smoke on default (Base) deploy**

```bash
bun dev
```

Visit `http://localhost:3000`:
- Landing renders with ETH symbol in hero/loop
- Chain line reads "Live on Base. Solana devnet preview."
- "Built on" stat shows `Base + Solana` (because `DEPLOYMENT_CHAIN` defaults to `multi` in local)
- Launch App → `/earn/eth`
- No devnet banner
- `/earn` → redirects to `/earn/eth`
- `/earn/tslax` loads (asset exists), but backend will return no prices — acceptable for smoke

- [ ] **Step 5: Manual smoke on Solana deploy**

Stop dev server. Re-run with Solana env inline:

```bash
NEXT_PUBLIC_DEPLOYMENT_CHAIN=solana \
NEXT_PUBLIC_DEPLOYMENT_ENV=devnet \
NEXT_PUBLIC_FEATURED_ASSET=sol \
NEXT_PUBLIC_SOLANA_RPC_URL="https://api.devnet.solana.com" \
NEXT_PUBLIC_SOLANA_USDC_MINT="4AxUuLpB1tnpyCSohZDf2tDq6xHab7H4gsenG4WTAKBD" \
NEXT_PUBLIC_SOLANA_TSLAX_MINT="H3sTci14zw4uVRNetdALKjv5KKHEab9M3rAJQ4BfhHaF" \
NEXT_PUBLIC_SOLANA_CHAIN="solana:devnet" \
bun dev
```

Visit `http://localhost:3000`:
- Devnet banner shows at top, dismissible
- Landing renders with SOL symbol throughout
- Chain line: "Solana devnet preview. Base mainnet live."
- "Built on" stat: `Solana`
- Launch App → `/earn/sol`
- Cross-subdomain pill in header: "Base (live) →"
- `/earn` → redirects to `/earn/sol`
- Asset selector shows SOL + TSLAx only
- `/earn/tslax` loads; if backend available, shows prices/capacity
- `/earn/eth` still loads (route not guarded, by design) — selector just won't show it

- [ ] **Step 6: Confirm positions flows untouched**

Visit `http://localhost:3000/positions` on both deploys. Page renders. Existing BASE positions (if any via wallet connect) render unchanged.

- [ ] **Step 7: Push branch + open PR**

```bash
git push -u origin feat/b1n-295-solana-devnet-tslax
```

Open PR targeting `dev` with title:
`B1N-295: Solana devnet frontend + multi-chain landing`

PR body template (use `gh pr create`):

```markdown
## Summary
- Adds TSLAx asset + Solana balance support for mock SPL.
- Introduces deployment helper; landing and earn components read featured asset / chain from env.
- Multi-chain landing story ("Now live on Base. Solana devnet preview.") visible on both subdomains.
- Dismissible devnet banner on devnet deploys.
- Cross-subdomain link pill in header.
- Asset selector filtered by deployment chain.
- Documents new env vars in `.env.example`.

## Test plan
- [ ] `bun test` green
- [ ] `bunx tsc --noEmit` clean
- [ ] `bun run build` clean
- [ ] Manual: default (multi) deploy shows ETH hero, multi-chain stat, no banner
- [ ] Manual: Solana devnet deploy shows SOL hero, devnet banner, cross-link
- [ ] Positions page renders on both deploys

Linear: [B1N-295](https://linear.app/b1nary/issue/B1N-295/frontendvercel-polish-solana-devnet-app-with-tslax-on-solanab1naryapp)
```

- [ ] **Step 8: Post completion summary on Linear issue**

Move B1N-295 to **Review**, comment:

```
PR: <URL from step 7>

What shipped:
- TSLAx asset registered, Solana balance reads TSLAx SPL.
- Deployment helper (chain/env/featured asset) drives landing + selector.
- Multi-chain landing copy ("Now live on Base. Solana devnet preview.") on both subdomains.
- Devnet banner (dismissible per session).
- Cross-subdomain header pill.
- `.env.example` documents new vars.

Vercel env for solana.b1nary.app (manual setup by @rafa):
NEXT_PUBLIC_DEPLOYMENT_CHAIN=solana
NEXT_PUBLIC_DEPLOYMENT_ENV=devnet
NEXT_PUBLIC_FEATURED_ASSET=sol
NEXT_PUBLIC_SOLANA_RPC_URL=<devnet RPC>
NEXT_PUBLIC_SOLANA_USDC_MINT=4AxUuLpB1tnpyCSohZDf2tDq6xHab7H4gsenG4WTAKBD
NEXT_PUBLIC_SOLANA_TSLAX_MINT=H3sTci14zw4uVRNetdALKjv5KKHEab9M3rAJQ4BfhHaF
NEXT_PUBLIC_SOLANA_CHAIN=solana:devnet
NEXT_PUBLIC_API_URL=<devnet backend>
```

---

## Self-Review Notes

- **Spec coverage**: Task 1 (deployment helper) → spec §1; Task 2 (TSLAx registry) → §2; Task 3 (balance) → §3; Task 4 (banner) → §4; Task 7 (landing) → §5; Task 9 (earn sweep) → §6; Task 5 (redirect) → §7; Task 10 (env example) → §8; Task 11 (verification) → §9 + §10. All spec sections covered.
- **Type consistency**: `getFeaturedAssetSlug`, `getDeploymentChain`, `getChainLabel`, `getHeroChainLine`, `getOtherSubdomain` match names across deployment helper and all call sites. `AssetConfig.fallbackSpot` added in Task 2 used in Task 7 landing spot fallback and AgentNativeSection.
- **Placeholder scan**: No TBD/TODO. Every step includes full code or explicit "grep call sites" workflow.
- **Deferred intentionally**: `BackgroundEffects` ETH tile (aesthetic, low value). Dev tests for full landing render variants (smoke-tested manually instead — rendering SSR-friendly Next.js landing in jsdom needs framer-motion shims that are out of scope).
