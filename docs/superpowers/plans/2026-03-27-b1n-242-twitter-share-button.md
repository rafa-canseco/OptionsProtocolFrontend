# B1N-242: Twitter Share Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secondary "Share on X/Twitter" button below the CTAs on both success screens in PriceMenuV2.tsx, opening a pre-filled tweet.

**Architecture:** Add `buildTweetUrl` as a pure helper in `src/lib/utils.ts` (consistent with `buildCalendarUrl`). Add an inline `XIcon` SVG component and a share button to each of the two success screen branches in `PriceMenuV2.tsx`. No new files or dependencies.

**Tech Stack:** Next.js, React, TypeScript, Vitest (jsdom), Tailwind/CSS vars

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `src/lib/utils.ts` | Modify | Add `buildTweetUrl` helper |
| `src/__tests__/buildTweetUrl.test.ts` | Create | Unit tests for `buildTweetUrl` |
| `src/components/v2/PriceMenuV2.tsx` | Modify | Add `XIcon` + Share button to both success screens |

---

## Task 1: `buildTweetUrl` helper + tests

**Files:**
- Modify: `src/lib/utils.ts`
- Create: `src/__tests__/buildTweetUrl.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/buildTweetUrl.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildTweetUrl } from "@/lib/utils";

describe("buildTweetUrl", () => {
  it("returns a Twitter intent URL", () => {
    const url = buildTweetUrl(45, "USDC");
    expect(url).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?text=/);
  });

  it("rounds APR to integer", () => {
    const url = buildTweetUrl(44.7, "ETH");
    expect(decodeURIComponent(url)).toContain("45%");
  });

  it("includes the asset symbol", () => {
    const url = buildTweetUrl(80, "cbBTC");
    expect(decodeURIComponent(url)).toContain("cbBTC");
  });

  it("includes @b1naryprotocol mention", () => {
    const url = buildTweetUrl(45, "USDC");
    expect(decodeURIComponent(url)).toContain("@b1naryprotocol");
  });

  it("includes b1nary.app link", () => {
    const url = buildTweetUrl(45, "USDC");
    expect(decodeURIComponent(url)).toContain("b1nary.app");
  });

  it("contains no emoji, hashtags, or 'options'", () => {
    const decoded = decodeURIComponent(buildTweetUrl(45, "USDC"));
    expect(decoded).not.toMatch(/#\w/);
    expect(decoded.toLowerCase()).not.toContain("option");
  });

  it("URL-encodes the tweet text", () => {
    const url = buildTweetUrl(45, "USDC");
    // The raw URL should not contain spaces
    const textParam = url.split("text=")[1];
    expect(textParam).not.toContain(" ");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend
bun vitest run src/__tests__/buildTweetUrl.test.ts
```

Expected: FAIL — `buildTweetUrl` is not exported from `@/lib/utils`.

- [ ] **Step 3: Add `buildTweetUrl` to `src/lib/utils.ts`**

Append to the end of `src/lib/utils.ts`:

```ts
export function buildTweetUrl(apr: number, assetSymbol: string): string {
  const text = `Just locked in ${Math.round(apr)}% APR on my ${assetSymbol} using @b1naryprotocol\n\nb1nary.app`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun vitest run src/__tests__/buildTweetUrl.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.ts src/__tests__/buildTweetUrl.test.ts
git commit -m "feat(B1N-242): add buildTweetUrl helper + tests"
```

---

## Task 2: Share button on single-strike success screen

**Files:**
- Modify: `src/components/v2/PriceMenuV2.tsx`

The single-strike success screen is the `if (accepted)` branch (around line 298). It currently ends with:
```tsx
<a href="/positions" ...>View my positions</a>
<button onClick={() => { setAccepted(null); ... }}>Accept another price</button>
```

- [ ] **Step 1: Add the `XIcon` inline SVG component**

At the top of `PriceMenuV2.tsx`, after the imports, add:

```tsx
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
```

- [ ] **Step 2: Add the Share button to the single-strike success screen**

In the `if (accepted)` branch, the `assetSymbol` for the tweet is `"USDC"` for buy (put) and `asset.symbol` for sell (call). Add the share button after the `"Accept another price"` button:

```tsx
{/* Share on X */}
<button
  onClick={() =>
    window.open(
      buildTweetUrl(apr, abuy ? "USDC" : asset.symbol),
      "_blank",
      "noopener,noreferrer",
    )
  }
  className="flex items-center justify-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors mx-auto"
>
  <XIcon />
  Share
</button>
```

Note: `apr` and `abuy` are already defined at the top of the `if (accepted)` branch:
- `const apr = computeAPR(aq.premium, aq.strike, aq.expiry_days);`
- `const abuy = as_ === "buy";`

- [ ] **Step 3: Add the import for `buildTweetUrl`**

`buildTweetUrl` is in `@/lib/utils`. The existing import line in `PriceMenuV2.tsx` is:

```ts
import { fmtUsd, floorTo } from "@/lib/utils";
```

Update it to:

```ts
import { fmtUsd, floorTo, buildTweetUrl } from "@/lib/utils";
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend
bun tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/v2/PriceMenuV2.tsx
git commit -m "feat(B1N-242): add share button to single-strike success screen"
```

---

## Task 3: Share button on range success screen

**Files:**
- Modify: `src/components/v2/PriceMenuV2.tsx`

The range success screen is the `if (rangeAccepted)` branch (around line 349). It ends with:
```tsx
<a href="/positions" ...>View my positions</a>
<button onClick={() => { setRangeAccepted(null); ... }}>Set another range</button>
```

- [ ] **Step 1: Add the Share button after "Set another range"**

```tsx
{/* Share on X */}
<button
  onClick={() =>
    window.open(
      buildTweetUrl(rangeAccepted.combinedApr, asset.symbol),
      "_blank",
      "noopener,noreferrer",
    )
  }
  className="flex items-center justify-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors mx-auto"
>
  <XIcon />
  Share
</button>
```

- [ ] **Step 2: Type-check**

```bash
bun tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
bun vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/v2/PriceMenuV2.tsx
git commit -m "feat(B1N-242): add share button to range success screen"
```

---

## Task 4: Manual verification checklist

- [ ] Start dev server: `bun dev`
- [ ] Accept a buy (put) position → success screen shows "Share" button below CTAs
- [ ] Click Share → new tab opens with `https://twitter.com/intent/tweet?text=...`
- [ ] Decoded text: `Just locked in X% APR on my USDC using @b1naryprotocol\n\nb1nary.app`
- [ ] Accept a sell (call) ETH position → tweet uses "ETH" not "USDC"
- [ ] Accept a range position → tweet uses "ETH" (or cbBTC), uses `combinedApr`
- [ ] Button is visually secondary — smaller than the green "View my positions" CTA
- [ ] No emoji, hashtag, or "option" in the tweet text
