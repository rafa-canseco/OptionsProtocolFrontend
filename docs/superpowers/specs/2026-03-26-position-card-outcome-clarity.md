# Position Card: Clear Outcome Text

**Date:** 2026-03-26
**Origin:** User testing feedback (Artur confused "at risk" as "won't execute")

---

## Problem

The active position card shows a "Price vs strike" progress bar with labels like "At risk", "Crossed", and "X% away" in color-coded text. Users misinterpret "at risk" as a negative/failure state, when it actually means assignment is likely. The progress bar adds visual noise without adding clarity.

---

## Solution

Replace the progress bar and risk labels with a single outcome sentence that tells the user exactly what will happen at expiry, based on current price vs strike.

---

## What changes

### Remove

- The `DistanceIndicator` component from active `PositionCard`
- The SVG progress bar, strike marker, spot marker
- "Price vs strike" header
- "X% away" / "At risk" / "Crossed" labels
- Color-coded distance logic (danger/warning/accent thresholds)

### Add

Two-line replacement in the same card area:

**Line 1 (outcome text):** prominent, white text
**Line 2 (current price):** secondary, smaller text showing `ETH now: $X,XXX`

### Outcome logic

Two states only. The cut is at the strike price. ATM (price == strike) = OTM per protocol rules.

**Put (user sells put, committed USD to buy asset):**

| Condition | Text |
|-----------|------|
| OTM (spot > strike) | `You keep $1,000 + $5.56 earned` |
| ITM (spot < strike) | `You'll buy ETH at $2,050 · $5.56 earned` |

**Call (user sells call, committed asset to sell):**

| Condition | Text |
|-----------|------|
| OTM (spot < strike) | `You keep 0.5 ETH + $5.56 earned` |
| ITM (spot > strike) | `You'll sell ETH at $2,050 · $5.56 earned` |

Where:
- `$1,000` / `0.5 ETH` = committed collateral (already displayed elsewhere on card as "Committed $1,000")
- `$5.56` = premium earned (already displayed as "$5.56 earned")
- `$2,050` = strike price
- `ETH` = the asset symbol, dynamic per market

### Formatting

- Outcome text: `text-sm font-medium text-[var(--text)]`
- "earned" amount: `text-[var(--accent)]` (green, same as current "$X earned")
- Current price line: `text-xs text-[var(--text-secondary)]`

### RangePositionCard

Same treatment. Remove the existing range bar status text ("At risk of assignment") and replace with outcome text. A range position has two legs:

| Condition | Text |
|-----------|------|
| In range (OTM both) | `You keep $1,000 + $5.56 earned` |
| Below range (put ITM) | `You'll buy ETH at $1,900 · $5.56 earned` |
| Above range (call ITM) | `You'll sell ETH at $2,100 · $5.56 earned` |

The `RangeBar` visual for showing the range zone can remain since it communicates where price sits relative to two bounds, which is harder to express in text alone. But the status label beneath it changes to the outcome text above.

---

## What stays the same

- Card header ("Buy ETH at $2,050/ETH")
- Countdown ("8h 42m left")
- Premium earned line ("$5.56 earned 203% APR")
- "Committed $1,000"
- "Open tx" link
- "Add to calendar" button (from B1N-208)
- Settled position cards (they already show the final outcome)
- Settled position cards (already show final outcome, don't use `DistanceIndicator`)

---

## Scope

- `PositionCard.tsx`: remove `DistanceIndicator`, add outcome text block
- `RangePositionCard.tsx`: replace status label with outcome text
- `DistanceIndicator.tsx`: can be deleted (only consumer is active `PositionCard`)

---

## Out of scope

- Changing settled card design
- Adding new color states or animations
- Notification/email UI (separate ticket B1N-208)
- Compact card mode changes

---

## Acceptance criteria

- [ ] Active position cards show outcome text instead of progress bar
- [ ] Put OTM shows "You keep {collateral} + {premium} earned"
- [ ] Put ITM shows "You'll buy {asset} at {strike} · {premium} earned"
- [ ] Call OTM shows "You keep {collateral} + {premium} earned"
- [ ] Call ITM shows "You'll sell {asset} at {strike} · {premium} earned"
- [ ] "ETH now: $X,XXX" shown below outcome text
- [ ] Range cards show correct outcome for in-range / below / above
- [ ] Settled cards unchanged
- [ ] No progress bar on active cards
