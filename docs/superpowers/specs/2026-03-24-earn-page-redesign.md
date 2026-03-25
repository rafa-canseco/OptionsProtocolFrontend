# Earn Page Redesign: Self-Explaining UI

## Problem

Users don't understand what they're doing on the Earn page without the founder explaining it verbally. The "aha moment" happens when they understand:

1. Not assigned = repeat, keep earning premiums
2. Assigned = you bought cheap, that's good
3. Next step = now sell higher, keep earning premiums

The UI currently fails to communicate this because:
- Tabs say "I'd buy" / "I'd sell" but don't explain why or what you need
- No context line explains why someone pays you
- Outcome cards use blue (OTM) vs gray (ITM), implying assignment is worse
- ITM card doesn't show the next step (sell higher / buy cheaper)
- Users don't know what to interact with first (date? amount? strike?)

## Solution

Four changes to make the Earn page self-explaining:

1. Rename tabs to orient by what the user has
2. Add context lines that explain the benefit and why you get paid
3. Redesign outcome cards with equal visual weight and next-step guidance
4. Add a guided tutorial mode for first-time users

## Scope

- Frontend only (no backend, no contract changes)
- Earn page (`PriceMenuV2.tsx`, `OutcomeCards.tsx`)
- Landing page tab consistency (`LandingPage.tsx`)
- New tutorial mode component

---

## 1. Tab Rename

### Before
```
[ Range ]  [ I'd buy ]  [ I'd sell ]
```
Default: Range

### After
```
[ I have USD ]  [ I have {symbol} ]  [ Range ]
```
Default: "I have USD" (most users arrive with dollars)

The sell tab label is dynamic: "I have ETH", "I have cbBTC", etc., based on `asset.symbol`. The buy tab is always "I have USD" since collateral is always USDC.

Tab order already committed on `feat/earn-tab-reorder` (Buy > Sell > Range, default Buy). This spec changes the labels only. Internal state values remain `"buy"`, `"sell"`, `"range"` unchanged. Query params (`?side=buy`, `?side=sell`, `?side=range`) used by PositionCard, TradeLog, and RangePositionCard continue to work as-is.

### Mapping
| New tab | Internal side | Options term |
|---------|--------------|--------------|
| I have USD | buy | Cash-secured put |
| I have {symbol} | sell | Covered call |
| Range | range | Strangle |

---

## 2. Context Lines

A header + subtext below the tab toggle, above the duration selector. Always visible. Not a tooltip.

All copy below uses `{symbol}` as placeholder for the current asset (ETH, cbBTC, etc.).

### I have USD
> **Buy {symbol} cheaper.**
> Set a price you'd buy {symbol} at. A trader pays you for that commitment. Price hits? You buy. Doesn't? Your dollars come back. You keep the payment either way.

### I have {symbol}
> **Sell {symbol} higher.**
> Set a price you'd sell {symbol} at. A trader pays you for that commitment. Price hits? You sell at your price. Doesn't? Your {symbol} comes back. You keep the payment either way.

### Range
> **Earn from both sides.**
> Set a buy price and a sell price. You earn from both commitments. If {symbol} stays in your range, everything comes back. You keep both payments.

### Implementation
- New `ContextLine` component rendered between tab toggle and duration selector
- Content switches based on `side` state
- Header in `text-[var(--bone)]` semibold, subtext in `text-[var(--text-secondary)]`

---

## 3. Outcome Cards Redesign

### Problem
- OTM card: accent background (blue), checkmark icon = "good outcome"
- ITM card: gray background, arrow icon = "bad outcome"
- ITM card has no guidance on what to do next
- Users think assignment = loss

### Design

Both cards get equal visual weight. Both use accent styling. The difference is content, not color.

#### Buy side (I have USD)

**OTM card (price stays above strike):**
- Icon: checkmark (keep)
- Title: "Price stays above $2,400"
- Line 1: "$100 back"
- Line 2: "+ keep $4.20"
- Subtext: "Earn again"

**ITM card (price reaches strike):**
- Icon: arrow-right (transition to next step)
- Title: "Price reaches $2,400"
- Line 1: "You buy ETH at $2,400"
- Line 2: "+ keep $4.20"
- Subtext: "Next: sell above $2,400"

#### Sell side (I have ETH)

**OTM card (price stays below strike):**
- Icon: checkmark
- Title: "Price stays below $3,000"
- Line 1: "1 ETH back"
- Line 2: "+ keep $58"
- Subtext: "Earn again"

**ITM card (price reaches strike):**
- Icon: arrow-right
- Title: "Price reaches $3,000"
- Line 1: "You sell ETH at $3,000"
- Line 2: "+ keep $58"
- Subtext: "Next: buy below $3,000"

### Visual changes
- Remove gray background from ITM card
- Both cards: `bg-[var(--accent)]/8 border border-[var(--accent)]/20`
- Both cards: accent-colored premium line
- Subtext ("Earn again" / "Next: sell above $X") in `text-[var(--text-secondary)]` with subtle arrow

### What NOT to say
- "That's below market" (may not be true at assignment time)
- "You lost" / any loss framing
- "Unrealized loss" (true but scary, not helpful)

---

## 4. Tutorial Mode (Guided Walkthrough)

### Trigger
A button where "How does this work?" currently lives:

```
[ Guide me through it ]  [ How does this work? ]
```

"How does this work?" drawer remains available. "Guide me through it" activates the walkthrough.

### Behavior
- Everything outside the current step is dimmed (opacity ~0.3, pointer-events: none)
- Values are pre-filled so the user sees a complete example
- Each step has a callout explaining the element
- User advances with "Next" button or by interacting with the element
- Tutorial state persists in localStorage (don't show again after completion)
- User can exit tutorial at any time (X button or "Skip")

### Pre-fill values
- Duration: first available expiry (auto-selected)
- Amount: $100 (USD tab) or 0.05 ETH (ETH tab)
- Strike: closest strike to spot (auto-selected)

### Steps

**Step 1: Duration**
- Highlight: duration button group
- Pre-fill: first expiry selected
- Callout: "How long do you commit? Shorter = sooner you get your money back."

**Step 2: Amount**
- Highlight: amount input + % shortcuts
- Pre-fill: $100
- Callout: "How much do you want to put to work? You get this back if the price doesn't hit your target."

**Step 3: Your price**
- Highlight: strike price list
- Pre-fill: closest strike selected, earnings visible
- Callout: "Pick the price you'd buy {symbol} at. Closer to market = more earnings. Further away = safer."

**Step 4a: Outcome A (OTM)**
- Highlight: left outcome card only, right card dimmed
- Callout: "Price didn't hit your target? Your $100 comes back. You keep the $4.20. Set a new price and earn again next week."

**Step 4b: Outcome B (ITM)**
- Highlight: right outcome card only, left card dimmed
- Callout: "Price hit? You just bought ETH at the price you chose. You keep the $4.20. Now set a sell price above $2,400. You earn another premium, and when you sell, you sell higher than you bought. Premiums + buy low, sell high."

**Step 5: Accept**
- Highlight: accept button (glowing)
- All other elements visible again
- Callout: "Ready. Hit accept to start earning."

### Implementation
- Use `driver.js` library for the guided tour (handles overlay dimming, element highlighting across grid layouts, scroll-to-element, and callout positioning out of the box). Avoids building a custom overlay that fights with the sticky column and grid stacking contexts.
- Stepper state machine (step 1-5, with 4a/4b as sub-steps)
- Pre-fill logic sets `amountStr` and `selectedQuote` on tutorial start. Tutorial must wait for prices to load before starting (disable "Guide me through it" button while `loading` is true).
- On tutorial exit (complete or skip): keep the pre-filled values as-is so the user can immediately hit Accept.
- localStorage key: `b1nary-tutorial-completed`
- On mobile: `driver.js` handles auto-scroll to highlighted elements. Steps 4a/4b work because outcome cards render in a 2-col grid even on mobile.

---

## 5. Landing Page Consistency

Update toggle labels in BOTH landing page toggle components:

1. `LandingPage.tsx` `SideToggle` (used by MechanismSection)
2. `PriceSlider.tsx` inline toggle (has its own "I'd buy" / "I'd sell" buttons)

| Before | After |
|--------|-------|
| "I'd buy" | "I have USD" |
| "I'd sell" | "I have ETH" |

Note: Landing page is ETH-only, so "I have ETH" is hardcoded (not dynamic).

The rest of the landing page content (loop animation, outcomes, etc.) stays the same. Landing page copy improvements (explaining why you get paid) are a separate task.

---

## Files affected

| File | Change |
|------|--------|
| `frontend/src/components/v2/PriceMenuV2.tsx` | Tab labels, context line, tutorial trigger |
| `frontend/src/components/v2/OutcomeCards.tsx` | Card redesign (both accent, next-step copy, "reaches" wording) |
| `frontend/src/components/v2/RangeOutcomeCards.tsx` | Match visual parity (both outcomes accent, no gray) |
| `frontend/src/components/landing/LandingPage.tsx` | SideToggle label consistency |
| `frontend/src/components/landing/PriceSlider.tsx` | Inline toggle label consistency |
| `frontend/src/components/v2/TutorialOverlay.tsx` | New: guided walkthrough using driver.js |
| `frontend/src/components/v2/ContextLine.tsx` | New: context line component |
| `frontend/src/components/v2/RangeEarn.tsx` | Remove duplicate inline explanation (replaced by ContextLine) |

## Out of scope

- Landing page copy improvements (why you get paid, loop explanation)
- Positions page post-expiry CTAs ("Earn again" / "Sell higher" buttons)
- HowItWorksDrawer content update
- Backend or contract changes

## Acceptance criteria

1. Tabs read "I have USD" / "I have {symbol}" / "Range", default is "I have USD"
2. Sell tab dynamically shows correct asset symbol (ETH, cbBTC, etc.)
3. Context line visible below tabs explaining benefit and why you get paid
4. Both outcome cards have equal visual weight (no gray card)
5. ITM card wording uses "reaches" not "drops/rises"
6. ITM card shows next step ("Next: sell above $X" / "Next: buy below $X")
7. RangeOutcomeCards updated to match visual parity (no gray cards)
8. Tutorial mode activatable from button, walks through 5 steps with dimming
9. Tutorial pre-fills values so cards show real numbers from step 1
10. Tutorial step 4 splits into two sub-steps explaining each outcome narratively
11. Tutorial disabled while prices are loading
12. Both landing page toggles (SideToggle + PriceSlider) match Earn page labels
13. Tutorial completion persisted in localStorage
14. RangeEarn duplicate explanation removed (replaced by ContextLine)
