# B1N-295 — Solana Devnet Frontend: TSLAx + Landing Adaptation

**Linear:** [B1N-295](https://linear.app/b1nary/issue/B1N-295/frontendvercel-polish-solana-devnet-app-with-tslax-on-solanab1naryapp)
**Date:** 2026-04-20
**Branch:** `feat/b1n-295-solana-devnet-tslax`

## Goal

Ship `solana.b1nary.app` as a polished Solana devnet frontend supporting SOL and mock TSLAx. Adapt copy — landing and earn flow — so chain/asset references are no longer hard-coded to ETH/Base. Add clear devnet/demo cues so users don't confuse mock TSLAx with the real mainnet token.

## Non-Goals

- Positions, leaderboard, and docs pages: stay as-is. Out of scope.
- No landing variants (stocks-forward, chain-forward): single generic multi-chain landing.
- No brand change: wordmark stays "b1nary" on both subdomains.
- No mainnet Solana wiring. Devnet only.
- Real TSLAx mainnet mint stays reference-only; never used in tx.

## Deployment Model

Two separate Vercel deployments pointing at the same codebase:

| Domain | Env vars | Default asset | Banner |
|---|---|---|---|
| `app.b1nary.app` (existing Base) | unchanged | `eth` | none |
| `solana.b1nary.app` (new) | new bundle below | `sol` | devnet banner |

Runtime differentiation via `NEXT_PUBLIC_DEPLOYMENT_CHAIN` and `NEXT_PUBLIC_DEPLOYMENT_ENV`. Same bundle served on both; env flags pick the featured asset and banner visibility.

## Decisions

1. **Landing variant**: single generic multi-chain landing. Copy is asset-agnostic; symbol/spot comes from the featured asset resolver.
2. **Brand**: "b1nary" everywhere; no "b1nary Solana" wordmark.
3. **TSLAx label**: `symbol="TSLAx"`, `name="Tesla (devnet mock)"`. Unambiguous in selector.
4. **Scope**: landing + earn components + devnet banner + TSLAx asset registration + Vercel env. Positions/leaderboard/docs unchanged.
5. **Devnet banner**: new component, sticky below header, dismissible per session. Rendered when `isDevnet()` is true.

## Design

### 1. Deployment helper (new file)

`src/lib/deployment.ts`:

```ts
import { ASSETS } from "@/lib/assets";

export type DeploymentChain = "base" | "solana" | "multi";
export type DeploymentEnv = "mainnet" | "testnet" | "devnet";

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
```

### 2. Assets registry — add TSLAx

Add to `src/lib/assets.ts`:

```ts
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
}
```

`DEFAULT_ASSET` becomes a computed getter backed by `getFeaturedAssetSlug()`. Existing callers of `DEFAULT_ASSET` are updated to use the getter.

Update `ASSET_LOGOS` in `AssetSelector`:

```ts
tslax: "/tslax.png",
```

Add `public/tslax.png` as a placeholder (uses neutral stock icon). User can swap in brand art later.

### 3. Solana balance — TSLAx support

Extend `useSolanaBalance` to fetch TSLAx SPL balance when the mint is configured:

```ts
interface SolanaBalance {
  // existing fields
  solanaTslaxRaw: bigint;
  solanaTslax: number;
}
```

Add mint constant to `src/lib/solana.ts`:

```ts
export const SOLANA_TSLAX_MINT =
  process.env.NEXT_PUBLIC_SOLANA_TSLAX_MINT ?? "";
```

`useSolanaBalance` skips the TSLAx read when the mint is empty (so Base deploy still works).

### 4. Devnet banner (new component)

`src/components/DevnetBanner.tsx`:

- Rendered inside landing and app root layouts
- Visible only when `isDevnet()` is true
- Sticky below nav, full-width, dismissible via `sessionStorage` key `b1nary:devnet-banner-dismissed`
- Copy: "Devnet preview — mock assets, no real funds. Positions here do not reflect mainnet."
- Link: "Learn more" → `https://docs.b1nary.app/devnet` (added if docs page exists, else omit)

### 5. Landing copy — asset-agnostic

`src/components/landing/LandingPage.tsx` changes:

**Featured asset resolution at top of `LandingPage`:**

```ts
const featuredSlug = getFeaturedAssetSlug();
const featuredAsset = ASSETS[featuredSlug];
```

Pass `featuredAsset` down to `MechanismSection`, `LoopSection`, `AgentNativeSection`.

**MechanismSection:**
- `useSpot(featuredSlug)` instead of hard-coded `"eth"`
- Spot line: `{featuredAsset.symbol} is ${spot}`
- Toggle label: `I have {featuredAsset.symbol}` (keep "I have USD" for buy)
- Outcome card: `Buy/Sell {featuredAsset.symbol} at $X`
- `Your ${strike.toLocaleString()} comes back` and `Your {symbol} comes back` now use symbol

**LoopSection:**
- `buildLoopFrames(side, buyStrike, sellStrike, buyPremium, sellPremium, symbol)`
- Frame strings: ``Buy ${symbol} @ ${bs}``, ``Sell ${symbol} @ ${ss}``
- ``You now have ${symbol}.`` and ``You now have dollars.``

**ComparisonSection:**
- `Staking ETH` → `Staking ${featuredAsset.symbol}` (ETH for Base, SOL for Solana)
- `Lending (Aave)` → `Lending (Aave)` for Base, `Lending (Kamino)` for Solana
- Use a small mapping keyed by `featuredAsset.chain`

**AgentNativeSection terminal:**
- Use `featuredAsset.symbol` in example strings
- Sample strike: `featuredAsset.chain === "solana" ? 180 : 2800`

**SocialProofSection:**
- `Built on` stat: `Base` for Base, `Solana` for Solana, `Base + Solana` for `multi`
- Footer subtitle: `Open source · Audited · Live on {chainLabel}`

**CTA buttons:**
- `Launch App` → `/earn` (redirect there uses featured asset)

### 6. Earn flow — asset-agnostic copy pass

Audit strings in:

- `src/components/v2/PriceMenuV2.tsx`
- `src/components/v2/AssetSelector.tsx` (already asset-aware; verify)
- `src/components/AcceptModal.tsx`
- `src/components/v2/OutcomeCards.tsx`
- `src/components/v2/RangeEarn.tsx`
- `src/components/v2/EarnTutorial.tsx`

Replace any hard-coded `"ETH"`, `"Base"`, `"cbBTC"` strings with the active `AssetConfig`'s `symbol` / chain label. Scope: only visible UI copy — not variable names, comments, or tests.

Render a small `devnet` chip next to the asset pill in `PriceMenuV2` when `isDevnet()`.

### 7. Earn index redirect

`src/app/earn/page.tsx`:

```ts
import { redirect } from "next/navigation";
import { getFeaturedAssetSlug } from "@/lib/deployment";

export default function EarnPage() {
  redirect(`/earn/${getFeaturedAssetSlug()}`);
}
```

### 8. Vercel env — `solana.b1nary.app`

New Vercel project (or new environment on existing project) with these vars:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_DEPLOYMENT_CHAIN` | `solana` |
| `NEXT_PUBLIC_DEPLOYMENT_ENV` | `devnet` |
| `NEXT_PUBLIC_FEATURED_ASSET` | `sol` |
| `NEXT_PUBLIC_API_URL` | devnet backend URL from B1N-293 |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana devnet RPC |
| `NEXT_PUBLIC_SOLANA_CHAIN` | `solana:devnet` |
| `NEXT_PUBLIC_SOLANA_USDC_MINT` | `4AxUuLpB1tnpyCSohZDf2tDq6xHab7H4gsenG4WTAKBD` |
| `NEXT_PUBLIC_SOLANA_TSLAX_MINT` | `H3sTci14zw4uVRNetdALKjv5KKHEab9M3rAJQ4BfhHaF` |
| `NEXT_PUBLIC_SOLANA_EXPLORER_URL` | `https://solscan.io` |
| `NEXT_PUBLIC_PRIVY_APP_ID` | same as Base (or separate Privy app if required) |

Existing Base deploy keeps its current env; add `NEXT_PUBLIC_DEPLOYMENT_CHAIN=base` and `NEXT_PUBLIC_DEPLOYMENT_ENV=testnet` (or `mainnet`) to avoid relying on defaults.

Document all new vars in `.env.example` with comments.

### 9. Tests

- Unit: `getFeaturedAssetSlug`, `getDeploymentChain`, `isDevnet` with various env values
- Unit: `useSolanaBalance` TSLAx branch — mocked `getParsedTokenAccountsByOwner` returns mint-specific accounts; assert TSLAx fields populated when mint set, zero when empty
- Snapshot or targeted render test: landing renders with `DEPLOYMENT_CHAIN=solana` showing SOL in hero/loop/comparison/terminal
- Manual QA checklist:
  - `solana.b1nary.app/earn/sol` loads, price, capacity, balance render
  - `solana.b1nary.app/earn/tslax` loads
  - devnet banner visible, dismiss persists per session
  - asset selector shows SOL, TSLAx with Solana chip; Base ETH/cbBTC hidden? (see Open Question 1)
  - `app.b1nary.app` unchanged (ETH default, Base stats, no banner)

### 10. Rollout

1. Merge PR to `dev`. Backend + MM (B1N-293, B1N-294) must be green on devnet first.
2. User creates Vercel domain `solana.b1nary.app` and sets env vars (manual, out of instance scope).
3. Preview deploy → smoke test → promote to prod.

## Open Questions (resolved)

**1. Asset selector filtering on Solana subdomain**: show only Solana-chain assets (SOL, TSLAx) when `DEPLOYMENT_CHAIN=solana`, and only Base-chain assets (ETH, cbBTC) when `DEPLOYMENT_CHAIN=base`. Multi-chain landing still lists all for the comparison/hero, but selector is filtered.

Resolution: filter in `AssetSelector`. Cross-chain assets hidden, not disabled, on single-chain deploys. Implementation: `ASSET_SLUGS.filter(s => matchesChain(ASSETS[s].chain, deploymentChain))`.

**2. Fallback spot when feed is slow**: landing currently uses `FALLBACK_SPOT = 2621` (ETH-flavored). Resolution: add per-asset fallback in `AssetConfig` (`fallbackSpot`), default ETH to 2621, SOL to 180, TSLAx to 350. Consumed by landing hero.

## Adversarial Review

**Objection 1**: TSLAx is the interesting product story (first tokenized stock on b1nary). Why not lead the Solana landing with stock-forward copy?

*Response*: Deliberately chose not to. Reasons:
1. Devnet only — no real TSLAx liquidity — so a marketing claim would be dishonest.
2. YAGNI: introduces a second landing variant, doubles copy maintenance.
3. If/when TSLAx goes to mainnet, we add a `LANDING_VARIANT=stocks` flag then.

**Objection 2**: Filtering assets by chain on the selector hides "coming soon" cross-chain discovery. Power user looking at the Solana app might want to know b1nary also runs on Base.

*Response*: The cross-chain story lives on the landing (comparison, stats, multi-chain messaging). App-level selector is task-focused; showing ETH on the Solana app just adds confusion because the user can't act on it. Single-chain selector is the right trade-off.

**Objection 3**: `getFeaturedAssetSlug` defaults silently if env is unset. A misconfigured Vercel deploy falls back to ETH and doesn't surface the misconfiguration.

*Response*: Add a `console.warn` when `NEXT_PUBLIC_DEPLOYMENT_CHAIN` is unset on a deployment build (not dev). Soft signal, not a hard fail — we want the site to still render. Hard-fail is too brittle for a landing page.

## File-Level Plan

| File | Change |
|---|---|
| `src/lib/deployment.ts` | NEW — helpers |
| `src/lib/assets.ts` | add TSLAx; `DEFAULT_ASSET` → getter; `fallbackSpot` field |
| `src/lib/solana.ts` | add `SOLANA_TSLAX_MINT` |
| `src/hooks/useSolanaBalance.ts` | fetch TSLAx SPL when mint set |
| `src/components/DevnetBanner.tsx` | NEW |
| `src/components/landing/LandingPage.tsx` | asset-agnostic strings; render banner; chain-aware stats |
| `src/components/v2/AssetSelector.tsx` | filter by `DEPLOYMENT_CHAIN`; TSLAx logo |
| `src/components/v2/PriceMenuV2.tsx` | devnet chip near asset pill; copy sweep |
| `src/components/v2/OutcomeCards.tsx` | copy sweep |
| `src/components/v2/RangeEarn.tsx` | copy sweep |
| `src/components/v2/EarnTutorial.tsx` | copy sweep |
| `src/components/AcceptModal.tsx` | copy sweep |
| `src/app/earn/page.tsx` | redirect uses `getFeaturedAssetSlug()` |
| `src/app/layout.tsx` | mount `DevnetBanner` if enabled |
| `public/tslax.png` | placeholder logo |
| `.env.example` | document `NEXT_PUBLIC_DEPLOYMENT_*`, `NEXT_PUBLIC_FEATURED_ASSET`, `NEXT_PUBLIC_SOLANA_TSLAX_MINT` |
| `src/__tests__/deployment.test.ts` | NEW unit tests |
| `src/__tests__/useSolanaBalance.test.ts` | extend for TSLAx |

## Acceptance Criteria (from Linear)

- [x] `solana.b1nary.app/earn/sol` works against devnet → env + existing SOL flow
- [x] `solana.b1nary.app/earn/tslax` loads prices, capacity, wallet balances → TSLAx asset + balance hook
- [x] Users connect Solana wallet and see mock USDC/TSLAx balances → `useSolanaBalance` extension
- [x] SOL existing flows do not regress → featured-asset resolver preserves current behavior on Base
- [x] TSLAx put/call UI renders correctly across desktop and mobile → rendered via existing `PriceMenuV2` (already responsive)
- [x] Vercel deployment uses devnet/staging API → env var bundle
- [x] Clear devnet/demo copy → devnet banner + asset name suffix
