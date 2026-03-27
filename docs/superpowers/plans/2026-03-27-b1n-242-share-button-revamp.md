# Share Button Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Twitter share button: better copy via a `mode` param, outlined button style, and Share moved first above the other CTAs.

**Architecture:** Add a `mode: "buy" | "sell" | "range"` param to `buildTweetUrl` in utils, update tests to cover all three templates, then update both success screens in `PriceMenuV2.tsx` to reorder CTAs and apply the new button style.

**Tech Stack:** TypeScript, React, Tailwind/CSS vars, Vitest

---

## File Map

| File | Action |
|------|--------|
| `src/lib/utils.ts` | Update `buildTweetUrl` — add `mode` param, new copy templates |
| `src/__tests__/buildTweetUrl.test.ts` | Replace all tests for new signature and copy |
| `src/components/v2/PriceMenuV2.tsx` | Update both success screens: new call sites, button style, CTA order |

---

## Task 1: Update `buildTweetUrl` — new signature + tests

**Files:**
- Modify: `src/lib/utils.ts`
- Modify: `src/__tests__/buildTweetUrl.test.ts`

- [ ] **Step 1: Replace the test file with tests for the new signature**

Replace the full contents of `src/__tests__/buildTweetUrl.test.ts` with:

```ts
// src/__tests__/buildTweetUrl.test.ts
import { describe, it, expect } from "vitest";
import { buildTweetUrl } from "@/lib/utils";

describe("buildTweetUrl", () => {
  it("returns a Twitter intent URL for all modes", () => {
    for (const mode of ["buy", "sell", "range"] as const) {
      const url = buildTweetUrl(89, "ETH", mode);
      expect(url).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?text=/);
    }
  });

  it("buy — uses 'buy' template with USDC collateral", () => {
    const decoded = decodeURIComponent(buildTweetUrl(89, "ETH", "buy"));
    expect(decoded).toContain("Set the price I'd buy ETH at.");
    expect(decoded).toContain("89% APR on my USDC.");
  });

  it("sell — uses 'sell' template with asset collateral", () => {
    const decoded = decodeURIComponent(buildTweetUrl(120, "ETH", "sell"));
    expect(decoded).toContain("Set the price I'd sell ETH at.");
    expect(decoded).toContain("120% APR on my ETH.");
  });

  it("range — uses range template with USDC collateral", () => {
    const decoded = decodeURIComponent(buildTweetUrl(75, "ETH", "range"));
    expect(decoded).toContain("Got paid to set an ETH range.");
    expect(decoded).toContain("75% APR on my USDC.");
  });

  it("rounds APR to integer", () => {
    const decoded = decodeURIComponent(buildTweetUrl(44.7, "ETH", "buy"));
    expect(decoded).toContain("45% APR");
  });

  it("uses asset symbol dynamically (cbBTC)", () => {
    const decoded = decodeURIComponent(buildTweetUrl(80, "cbBTC", "sell"));
    expect(decoded).toContain("cbBTC");
  });

  it("includes @b1naryprotocol in all modes", () => {
    for (const mode of ["buy", "sell", "range"] as const) {
      const decoded = decodeURIComponent(buildTweetUrl(89, "ETH", mode));
      expect(decoded).toContain("@b1naryprotocol");
    }
  });

  it("includes b1nary.app in all modes", () => {
    for (const mode of ["buy", "sell", "range"] as const) {
      const decoded = decodeURIComponent(buildTweetUrl(89, "ETH", mode));
      expect(decoded).toContain("b1nary.app");
    }
  });

  it("URL-encodes the tweet text (no spaces in query param)", () => {
    for (const mode of ["buy", "sell", "range"] as const) {
      const url = buildTweetUrl(89, "ETH", mode);
      const textParam = url.split("text=")[1];
      expect(textParam).not.toContain(" ");
    }
  });

  it("contains no emoji, hashtags, or 'options'", () => {
    for (const mode of ["buy", "sell", "range"] as const) {
      const decoded = decodeURIComponent(buildTweetUrl(89, "ETH", mode));
      expect(decoded).not.toMatch(/#\w/);
      expect(decoded.toLowerCase()).not.toContain("option");
    }
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend
bun vitest run src/__tests__/buildTweetUrl.test.ts
```

Expected: FAIL — current `buildTweetUrl` doesn't accept a `mode` param.

- [ ] **Step 3: Update `buildTweetUrl` in `src/lib/utils.ts`**

Replace the existing `buildTweetUrl` function (last function in the file) with:

```ts
export function buildTweetUrl(
  apr: number,
  assetSymbol: string,
  mode: "buy" | "sell" | "range",
): string {
  const rounded = Math.round(apr);
  let text: string;
  if (mode === "buy") {
    text = `Set the price I'd buy ${assetSymbol} at. ${rounded}% APR on my USDC.\n@b1naryprotocol b1nary.app`;
  } else if (mode === "sell") {
    text = `Set the price I'd sell ${assetSymbol} at. ${rounded}% APR on my ${assetSymbol}.\n@b1naryprotocol b1nary.app`;
  } else {
    text = `Got paid to set an ${assetSymbol} range. ${rounded}% APR on my USDC.\n@b1naryprotocol b1nary.app`;
  }
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun vitest run src/__tests__/buildTweetUrl.test.ts
```

Expected: 10 tests pass.

- [ ] **Step 5: Type-check**

```bash
bun tsc --noEmit
```

Expected: errors in `PriceMenuV2.tsx` only (stale call sites — fixed in Task 2).

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils.ts src/__tests__/buildTweetUrl.test.ts
git commit -m "feat: update buildTweetUrl with mode param and new copy templates"
```

---

## Task 2: Update single-strike success screen

**Files:**
- Modify: `src/components/v2/PriceMenuV2.tsx`

The single-strike success screen is the `if (accepted)` branch (~line 306). Current CTA order at the bottom: View positions → Accept another → Share.

The Share button currently has this call:
```tsx
buildTweetUrl(apr, abuy ? "USDC" : asset.symbol)
```
And this class:
```
"flex items-center justify-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors mx-auto"
```

- [ ] **Step 1: Replace the three bottom buttons in the `if (accepted)` branch**

Find this block (the three buttons at the bottom of the `if (accepted)` return):

```tsx
        <a
          href="/positions"
          className="block mx-auto max-w-xs rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          View my positions
        </a>
        <button
          onClick={() => { setAccepted(null); setSelectedQuote(null); setAmountStr(""); refresh(); }}
          className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          Accept another price
        </button>
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

Replace with (Share first, outlined; then View positions; then Accept another):

```tsx
        {/* Share on X — primary shareability CTA */}
        <button
          onClick={() =>
            window.open(
              buildTweetUrl(apr, asset.symbol, abuy ? "buy" : "sell"),
              "_blank",
              "noopener,noreferrer",
            )
          }
          className="flex items-center justify-center gap-2 mx-auto max-w-xs w-full rounded-xl border border-[var(--border)] py-3.5 text-sm font-semibold text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          <XIcon />
          Share on X
        </button>
        <a
          href="/positions"
          className="block mx-auto max-w-xs rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          View my positions
        </a>
        <button
          onClick={() => { setAccepted(null); setSelectedQuote(null); setAmountStr(""); refresh(); }}
          className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          Accept another price
        </button>
```

- [ ] **Step 2: Type-check**

```bash
bun tsc --noEmit
```

Expected: one remaining error in the `rangeAccepted` branch (fixed in Task 3).

- [ ] **Step 3: Commit**

```bash
git add src/components/v2/PriceMenuV2.tsx
git commit -m "feat: update share button style and CTA order on single-strike success screen"
```

---

## Task 3: Update range success screen

**Files:**
- Modify: `src/components/v2/PriceMenuV2.tsx`

The range success screen is the `if (rangeAccepted)` branch (~line 371). Same treatment as Task 2.

Current Share button call:
```tsx
buildTweetUrl(rangeAccepted.combinedApr, "USDC")
```

- [ ] **Step 1: Replace the three bottom buttons in the `if (rangeAccepted)` branch**

Find this block:

```tsx
        <a
          href="/positions"
          className="block mx-auto max-w-xs rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          View my positions
        </a>
        <button
          onClick={() => { setRangeAccepted(null); setSide("range"); refresh(); }}
          className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          Set another range
        </button>
        {/* Share on X */}
        <button
          onClick={() =>
            window.open(
              buildTweetUrl(rangeAccepted.combinedApr, "USDC"),
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

Replace with:

```tsx
        {/* Share on X — primary shareability CTA */}
        <button
          onClick={() =>
            window.open(
              buildTweetUrl(rangeAccepted.combinedApr, asset.symbol, "range"),
              "_blank",
              "noopener,noreferrer",
            )
          }
          className="flex items-center justify-center gap-2 mx-auto max-w-xs w-full rounded-xl border border-[var(--border)] py-3.5 text-sm font-semibold text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          <XIcon />
          Share on X
        </button>
        <a
          href="/positions"
          className="block mx-auto max-w-xs rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          View my positions
        </a>
        <button
          onClick={() => { setRangeAccepted(null); setSide("range"); refresh(); }}
          className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          Set another range
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

Expected: all tests pass (10 buildTweetUrl + existing 16 others = 26 total).

- [ ] **Step 4: Commit**

```bash
git add src/components/v2/PriceMenuV2.tsx
git commit -m "feat: update share button style and CTA order on range success screen"
```
