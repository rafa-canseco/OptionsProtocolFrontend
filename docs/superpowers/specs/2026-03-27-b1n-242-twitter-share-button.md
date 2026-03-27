# B1N-242: Twitter Share Button on Success Screen

**Date:** 2026-03-27
**Linear:** B1N-242
**File scope:** `src/components/v2/PriceMenuV2.tsx` only

---

## Problem

After accepting a position, users have no way to share the win. Every accepted position is a potential organic tweet for @b1naryprotocol.

---

## Solution

Add a secondary "Share" button (X/Twitter icon) below the two existing CTAs on both success screens. Clicking it opens a pre-filled Twitter intent URL. No API keys or auth required.

---

## Tweet template

```
Just locked in {apr}% APR on my {asset} using @b1naryprotocol

b1nary.app
```

- `{apr}` = rounded integer APR (no decimals)
- `{asset}` = collateral asset symbol — see table below
- No emoji, no hashtags, no mention of "options"

### Asset symbol per screen

| Screen | `asset` in tweet |
|--------|-----------------|
| Single buy (put) | `"USDC"` |
| Single sell (call) | `asset.symbol` (e.g. "ETH", "cbBTC") |
| Range | `asset.symbol` (range defined in terms of underlying) |

### APR per screen

| Screen | Source |
|--------|--------|
| Single | `computeAPR(aq.premium, aq.strike, aq.expiry_days)` |
| Range | `rangeAccepted.combinedApr` |

---

## Implementation

### Helper function (top of `PriceMenuV2.tsx`)

```ts
function buildTweetUrl(apr: number, assetSymbol: string): string {
  const text = `Just locked in ${Math.round(apr)}% APR on my ${assetSymbol} using @b1naryprotocol\n\nb1nary.app`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
```

### Share button JSX (same for both screens)

```tsx
<button
  onClick={() => window.open(buildTweetUrl(apr, assetSymbol), '_blank', 'noopener,noreferrer')}
  className="flex items-center justify-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors mx-auto"
>
  <XIcon />
  Share
</button>
```

`XIcon` is a small inline SVG — no new dependency.

### Layout (both screens)

```
$XX.XX earned. Yours to keep.
XX% APR
─────────────────────────
details...
[  View my positions  ]   ← primary CTA (unchanged)
Accept another price       ← secondary text CTA (unchanged)
𝕏 Share                   ← NEW, below existing CTAs
```

---

## Scope

- **Only file changed:** `src/components/v2/PriceMenuV2.tsx`
- No new components, no new files
- No changes to settled cards, position cards, or other screens

---

## Acceptance criteria

- [ ] Share button appears on single-strike success screen
- [ ] Share button appears on range success screen
- [ ] Clicking opens Twitter intent with correct pre-filled text
- [ ] APR is rounded integer, no decimals
- [ ] Buy success: asset = "USDC"
- [ ] Sell success: asset = asset.symbol (ETH / cbBTC)
- [ ] Range success: asset = asset.symbol
- [ ] Tweet includes `b1nary.app` link and `@b1naryprotocol`
- [ ] No emoji, no hashtags, no "options" in text
- [ ] Button is visually secondary to existing CTAs
- [ ] Opens in new tab with noopener,noreferrer
