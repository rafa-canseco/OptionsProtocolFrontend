# Landing Walkthrough + Asset Showcase

**Linear:** B1N-295 (follow-up observations)
**Date:** 2026-04-22
**Scope:** `frontend/` only — landing page redesign.

## Problem

External feedback on the current landing surfaced two gaps:

1. **The "how it works" explanation is thin on the landing.** The `HowItWorksDrawer` (`/earn` page) has a clear 4-step walkthrough, but the landing's `MechanismSection` shows only an interactive calculator without narrating the journey. New visitors see strike/premium numbers before they understand the flow.
2. **Assets are invisible.** The landing mentions "Base + Solana" in the Hero and `SocialProofSection`, but never names the tradeable assets. `cbBTC` and `TSLAx` are absent from every UI surface; the `AssetToggle` in `MechanismSection` only exposes `ETH | SOL`. TSLAx (tokenized Tesla stock on Solana devnet) is a product wedge that currently has zero presence.

## Goals

- Make the landing teach the 4-step flow (pick price → commit collateral → premium upfront → outcome at expiry) with a concrete running example.
- Make the 4 supported assets explicit: `ETH`, `cbBTC`, `SOL`, `TSLAx`.
- Use TSLAx as the running example in the walkthrough (neutral across chains and forces its visibility).
- Keep changes scoped to the landing. No routing/config changes, no `HowItWorksDrawer` edits, no earn flow changes.

## Non-goals

- Changing the drawer (`HowItWorksDrawer`) or the earn page.
- Adding live price feeds to the new Assets strip (static labels only).
- Filtering the Assets strip or MechanismSection toggle by subdomain. All 4 assets show on both `app.b1nary.app` and `solana.b1nary.app`.
- Wiring BTC or TSLAx into anything beyond the landing UI (they're already in the `ASSETS` registry at `src/lib/assets.ts`; deep integration with oracles and trading is out of scope here).

## Page structure

Current 8-section flow → new 10-section flow. Changes marked:

```
Hero
[NEW] AssetsStripSection          ← new
Problem
Engine
[NEW] HowItWorksSection           ← new (4-step walkthrough)
MechanismSection                  ← retitled + AssetToggle expanded
Comparison
AgentNative
SocialProof
CTA
AiCta
```

`BackgroundEffects`, header, and footer unchanged.

## Section 1 — `AssetsStripSection` (new)

**Placement:** Between `HeroSection` and the existing divider above `ProblemSection`.

**Purpose:** Compact, single-viewport strip that names the 4 assets and their chain, highlighting TSLAx without overselling.

**Design (from brainstorm: `assets-compact-v2.html` / v3):**

- Title strip:
  - Kicker (mono, uppercase, text-secondary): `Four assets · Two chains`
  - No `<h2>` — this is a strip, not a headline section. It should read as context between Hero and Problem.
- 4-column grid, centered, max width ~720px.
- Each column:
  - Asset symbol (monospace, `var(--bone)`, ~22px).
  - Chain label (mono, uppercase, `var(--text-secondary)`, 10px) with a 4px colored dot preceding it:
    - Base: dot `#3b82f6` (blue).
    - Solana: dot `#a855f7` (purple).
- Vertical 1px separators (`var(--border)`) between columns. No outer box.
- TSLAx column:
  - Symbol rendered in `var(--accent)` (cyan).
  - Chain label reads `Solana · New`.
  - Thin cyan gradient underline beneath the column with a soft cyan glow.
- No hover state, no live price, no links. This is a static scannable strip.

**Copy:**
```
kicker: Four assets · Two chains

ETH     cbBTC     SOL     TSLAx
Base    Base      Solana  Solana · New
```

**Padding:** `py-12` (roughly matches the existing Hero→Problem divider spacing).

## Section 2 — `HowItWorksSection` (new)

**Placement:** Between `EngineSection` and `MechanismSection`.

**Purpose:** Narrate the 4-step flow with a concrete TSLAx example, toggleable between Buy and Sell sides. This is the pedagogical section; the existing Mechanism section (retitled) becomes the "now try it yourself" section.

**Design (from brainstorm: `how-it-works-v2.html` / v2):**

- Section heading (`<h2>`, same type scale as other section titles): `How it works.`
- Subheading: `Walk through a concrete example.` (or equivalent short sub.)
- Side toggle directly below subheading: `I have USD` / `I have the asset` — same component style as the existing `SideToggle` in `MechanismSection`. Default = `I have USD` (buy side).
- Vertical timeline with a faint cyan gradient line running through numbered circles on the left.

### Steps

Each step is a row with a 24px numbered circle + a text column. The text column has:
- Bold step title (white, 15px).
- One-line body (secondary text, 12px).
- An example line in a thin cyan left-bordered callout: `<strong>Label:</strong> value`.

Step 4 is taller and contains a 2-column outcome grid instead of a single example callout.

**Buy-side (default) example — TSLAx:**

| Step | Title | Body | Example callout |
|------|-------|------|-----------------|
| 1 | Pick your price. | Choose a buy or sell price, size, and expiry. Further from spot = safer, lower premium. | **You:** "I'll buy 1 TSLAx at $320. 7-day expiry." |
| 2 | Commit your collateral. | To buy, stablecoins are locked. To sell, the asset is locked. 100% backed. No margin, no liquidation. | **Locked:** $320 USDC |
| 3 | Get paid the premium upfront. | A market maker pays immediately for the right to trade at that price. Yours regardless of outcome. | **You receive:** +$49 the moment you commit. |
| 4 | Wait for expiry. One of two things happens. | 7 days later the closing price settles it. | (see outcome grid below) |

**Step 4 outcome grid (buy side):**

```
┌─────────────────────────────┬─────────────────────────────┐
│ TSLAx closes ≤ $320         │ TSLAx closes > $320         │
│ You buy 1 TSLAx at $320.    │ Your $320 USDC comes back.  │
│ You already got +$49.       │ You already got +$49.       │
│ Effective cost: $271/share  │ Net: +$49 earned, no trade  │
└─────────────────────────────┴─────────────────────────────┘
```

**Sell-side example (toggle):**

| Step | Title | Body | Example callout |
|------|-------|------|-----------------|
| 1 | Pick your price. | (same body) | **You:** "I'll sell 1 TSLAx at $380. 7-day expiry." |
| 2 | Commit your collateral. | (same body) | **Locked:** 1 TSLAx |
| 3 | Get paid the premium upfront. | (same body) | **You receive:** +$37 the moment you commit. |
| 4 | Wait for expiry. One of two things happens. | (same body) | (see outcome grid below) |

**Step 4 outcome grid (sell side):**

```
┌─────────────────────────────┬─────────────────────────────┐
│ TSLAx closes ≥ $380         │ TSLAx closes < $380         │
│ You sell 1 TSLAx at $380.   │ Your TSLAx comes back.      │
│ You already got +$37.       │ You already got +$37.       │
│ Effective price: $417/share │ Net: +$37 earned, no trade  │
└─────────────────────────────┴─────────────────────────────┘
```

### Example numbers (rationale)

All numbers in the walkthrough are static copy — no dependency on the live price feed. The values were derived once from the existing `deriveStrikes` / `derivePremium` functions in `LandingPage.tsx` so they stay consistent with what the Mechanism section would display for TSLAx, then hardcoded:

- Spot = $350 (matches `ASSETS.tslax.fallbackSpot`).
- Strikes from `deriveStrikes(350)`: buy = $320, sell = $380.
- Premiums from `derivePremium` (sub-$500 rate band: 14% buy, 9% sell, adjusted for distance from spot): buy premium = $49, sell premium = $37.
- Effective cost (buy case): $320 − $49 = $271.
- Effective price (sell case): $380 + $37 = $417.

If future edits to `derivePremium` shift these numbers, update the hardcoded copy to stay consistent.

### Risk framing

The "can I lose money" concern is handled in-line in step 4 rather than as a separate section. The outcome grid shows both cases explicitly:
- If assigned: effective cost/price is always better than the strike thanks to the kept premium.
- If not assigned: capital back + premium earned.

## Section 3 — `MechanismSection` changes

**No structural rewrite.** Only three edits:

1. **Heading change:** `Here's how it works.` → `Try it with live prices.`
2. **Subheading (optional, if space):** A one-liner like "Same mechanic, your numbers." Keep if it reads well; drop otherwise.
3. **`AssetToggle` expansion:** Current options are `ETH | SOL`. New options: `ETH | cbBTC | SOL | TSLAx`.
   - Default selection follows `getDefaultAssetSlug(hostname)`:
     - `app.b1nary.app` → `ETH`.
     - `solana.b1nary.app` → `SOL`.
   - The toggle UI must accommodate 4 buttons without wrapping awkwardly on mobile. If it gets cramped, allow horizontal scroll (`overflow-x-auto`) on small viewports or wrap onto 2 rows.
   - The spot/strike/premium calculation already reads from the selected asset's `fallbackSpot` via `useSpot`/`useCoinGeckoSpot`/`usePrices`. Those hooks need to handle `cbBTC` and `TSLAx` gracefully:
     - If a live feed isn't available for an asset on this deployment, fall back silently to `ASSETS[slug].fallbackSpot`. The existing fallback chain already does this.
     - No new UI state for "price unavailable" — the skeleton/pulse already shown during `!priceReady` is sufficient.

The rest of `MechanismSection` (side toggle, outcome card, "where does the money come from" block) stays as-is.

## Unchanged sections

`ProblemSection`, `EngineSection`, `ComparisonSection`, `AgentNativeSection`, `SocialProofSection`, `CTASection`, `AiCtaSection`, header, footer — no edits.

- `AgentNativeSection` already uses `featuredAssetSymbol` so it adapts to subdomain. No change.
- `SocialProofSection` already says "Built on: Base + Solana" on both subdomains. No change.

## Accessibility

- Assets strip: each column should have an `aria-label` that includes the chain (e.g., `TSLAx on Solana, new`). Colored dots are decorative (`aria-hidden`).
- How it works timeline: step numbers are decorative (rendered via the circle). The step title is the semantic heading (`<h3>`). The example callouts use `<p>` — no additional ARIA needed.
- Buy/Sell toggle: mirror the existing `SideToggle`'s button semantics (radio-like).

## Testing

- Snapshot test for `AssetsStripSection` confirming all 4 asset symbols render with the right chain label and that TSLAx is the only column marked "New".
- Test for `HowItWorksSection` confirming:
  - Both Buy and Sell examples render the correct 4 step titles.
  - The step 4 outcome grid has two cells with the expected titles (`TSLAx closes ≤ $320` vs `TSLAx closes > $320` on buy; inverse on sell).
  - The toggle flips the example between buy and sell.
- Visual smoke: verify nothing regresses in `MechanismSection` after adding `cbBTC` and `TSLAx` options to the toggle (default asset still picked correctly per subdomain, calculator renders with fallback spot when live feed missing).
- `bun run tsc --noEmit` and `bun test` clean.

## Files touched (expected)

- `src/components/landing/LandingPage.tsx` — insert two new section components, retitle Mechanism heading, expand `AssetToggle` options.
- `src/components/landing/AssetsStrip.tsx` (new) — static strip component.
- `src/components/landing/HowItWorks.tsx` (new) — walkthrough section component.
- `src/__tests__/AssetsStrip.test.tsx` (new).
- `src/__tests__/HowItWorks.test.tsx` (new).

Extracting the two new sections as separate files (rather than keeping them inline like the other sections in `LandingPage.tsx`) because `LandingPage.tsx` is already ~1200 lines and two more sections make it harder to navigate. Existing sections stay inline for now.

## Open implementation notes (resolve during plan)

- If the Mechanism toggle overflows on mobile at 4 options, decide between horizontal scroll vs 2×2 wrap. Horizontal scroll is preferred — keeps the row-layout pattern used elsewhere on the site.
- MechanismSection subheading ("Same mechanic, your numbers.") is optional — keep only if it reads well with the existing layout.
