# B1N-242: Share Button Revamp

**Date:** 2026-03-27
**Builds on:** B1N-242 initial implementation (PR #161)
**File scope:** `src/lib/utils.ts`, `src/__tests__/buildTweetUrl.test.ts`, `src/components/v2/PriceMenuV2.tsx`

---

## Problem

The share button is invisible (ghost text at the bottom) and the tweet copy is generic. Both need to be improved to drive actual organic sharing.

---

## Changes

### 1. Tweet copy

Three distinct templates based on position type:

| Case | Template |
|------|----------|
| Buy (put) | `Set the price I'd buy {asset} at. {apr}% APR on my USDC.\n@b1naryprotocol b1nary.app` |
| Sell (call) | `Set the price I'd sell {asset} at. {apr}% APR on my {asset}.\n@b1naryprotocol b1nary.app` |
| Range | `Got paid to set an {asset} range. {apr}% APR on my USDC.\n@b1naryprotocol b1nary.app` |

Where:
- `{asset}` = `asset.symbol` (e.g. "ETH", "cbBTC") — the underlying, always
- `{apr}` = rounded integer APR
- `on my USDC` / `on my {asset}` = the collateral used

### 2. `buildTweetUrl` signature change

Replace `(apr, assetSymbol)` with `(apr, assetSymbol, mode)`:

```ts
export function buildTweetUrl(
  apr: number,
  assetSymbol: string,
  mode: "buy" | "sell" | "range",
): string
```

Tweet text per mode:
- `"buy"`: `Set the price I'd buy ${assetSymbol} at. ${Math.round(apr)}% APR on my USDC.\n@b1naryprotocol b1nary.app`
- `"sell"`: `Set the price I'd sell ${assetSymbol} at. ${Math.round(apr)}% APR on my ${assetSymbol}.\n@b1naryprotocol b1nary.app`
- `"range"`: `Got paid to set an ${assetSymbol} range. ${Math.round(apr)}% APR on my USDC.\n@b1naryprotocol b1nary.app`

Call sites:
- Single buy: `buildTweetUrl(apr, asset.symbol, "buy")`
- Single sell: `buildTweetUrl(apr, asset.symbol, "sell")`
- Range: `buildTweetUrl(rangeAccepted.combinedApr, asset.symbol, "range")`

### 3. CTA order (both screens)

**Before:** View positions → Accept another → Share (ghost)
**After:** Share (outlined) → View positions (green) → Accept another (ghost)

### 4. Share button style

Change from ghost text to outlined full-width button:

```tsx
className="flex items-center justify-center gap-2 mx-auto max-w-xs w-full rounded-xl border border-[var(--border)] py-3.5 text-sm font-semibold text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
```

---

## Acceptance criteria

- [ ] Buy success: tweet says "Set the price I'd buy ETH at. X% APR on my USDC."
- [ ] Sell success: tweet says "Set the price I'd sell ETH at. X% APR on my ETH."
- [ ] Range success: tweet says "Got paid to set an ETH range. X% APR on my USDC."
- [ ] APR is rounded integer
- [ ] Share button appears FIRST, above "View my positions"
- [ ] Share button is outlined (full-width, bordered), not ghost text
- [ ] "View my positions" remains the primary green CTA (second position)
- [ ] "Accept another price" / "Set another range" remains ghost text (third position)
- [ ] Tweet still includes `@b1naryprotocol` and `b1nary.app`
- [ ] No emoji, no hashtags, no "options" in text
- [ ] All tests updated and passing
