# B1N-208: Expiry Reminders — Calendar Link + Email Opt-in UI

**Date:** 2026-03-26
**Ticket:** [B1N-208](https://linear.app/b1nary/issue/B1N-208)
**Unblocked by:** B1N-232 (backend email notification endpoints)

---

## Problem

Users have no way to know when their options are about to expire or what the outcome was after settlement. This leads to missed opportunities and confusion.

---

## Solution Overview

Two independent reminder mechanisms added to the positions page:

1. **Calendar link** — per-position button on each active card. Generates a Google Calendar URL with expiry details. Zero backend.
2. **Email opt-in** — page-level banner that walks the user through a one-time email verification flow. Uses the backend endpoints from B1N-232.

---

## Layout Decision

- **Email banner**: above the "Active positions" section on `/positions`. Set up once per wallet, not per position.
- **Calendar button**: footer of each individual active `PositionCard`. Per-position because each has a different expiry date/time.
- **Graceful fallback**: if `GET /notifications/status` fails, the banner is hidden entirely. Calendar button always shows (no backend dependency).

---

## Components

### `src/hooks/useNotificationStatus.ts`

Fetches `GET /notifications/status?wallet={address}` on mount (when wallet is connected).

Returns:
```ts
{
  hasEmail: boolean
  verified: boolean
  unsubscribed: boolean
  loading: boolean
  error: boolean   // true if fetch failed → banner hides
  refetch: () => void
}
```

If the request throws or returns non-2xx, `error` is set to `true` and all boolean fields default to `false`. This is the graceful fallback — the banner simply does not render.

---

### `src/components/NotificationBanner.tsx`

Page-level component. Renders nothing if `error === true` or `loading === true` (no flash).

**Props:**
```ts
{
  walletAddress: string
  status: ReturnType<typeof useNotificationStatus>
}
```

**Internal state machine (5 states):**

| State | What renders |
|-------|-------------|
| `idle` | "Get expiry reminders" + "Set up →" button. If Privy `user.linkedAccounts` contains an entry with `type === "email"`, its `address` is pre-filled in the email input when the form opens. |
| `email-form` | Inline email `Input` + "Send code" button + Cancel. Calls `POST /notifications/email`. |
| `code-verify` | `InputOTP` (6 slots, two groups of 3 separated by dash). "Verify" button + "Resend code" link. Hint shows email address and "expires in 10 min". Calls `POST /notifications/verify`. |
| `verified` | "● Notifications on · {email}" + "Manage" button. Manage button triggers `Collapsible` expand. |
| `manage-open` | Verified state + `Collapsible` expanded showing "Change email" (resets to `email-form`) and "Turn off" (calls `POST /notifications/unsubscribe`, resets to `idle`). |

**State transitions:**
- Mount with `verified && !unsubscribed` → start in `verified`
- Mount with `has_email && !verified` → start in `idle` (treat as not set up)
- Mount with `!has_email || unsubscribed` → start in `idle`
- "Set up →" click → `email-form`
- "Send code" success → `code-verify`
- "Verify" success → `verified` + call `status.refetch()`
- "Turn off" success → `idle` + call `status.refetch()`
- "Change email" click → `email-form`
- Cancel (from `email-form` or `code-verify`) → previous state

**Error handling:**
- `POST /notifications/email` fails (rate limit, invalid email) → show inline error below input, stay in `email-form`
- `POST /notifications/verify` fails (wrong code, expired) → show inline error below OTP, stay in `code-verify`
- `POST /notifications/unsubscribe` fails → show inline error, stay in `manage-open`

**Shadcn components used:** `Input`, `Button`, `InputOTP` + `InputOTPGroup` + `InputOTPSlot` + `InputOTPSeparator`, `Collapsible` + `CollapsibleContent`

---

### Calendar URL — `buildCalendarUrl()` in `src/lib/utils.ts`

Generates a Google Calendar URL for a single active position.

**Inputs:** `position: Position`, `assetSymbol: string`

**Output:** Google Calendar URL string with:
- `text`: `b1nary: {ASSET} ${strike} {put|call} expiry`
- `dates`: expiry day at 08:00–09:00 UTC (ISO format `YYYYMMDDTHHmmssZ`)
- `details`: `Strike: ${strike} | Committed: {committedDisplay} | Premium earned: ${premium}`

The expiry timestamp on a position is midnight UTC on the expiry date; the calendar event uses 08:00 UTC (the actual settlement time).

---

### `src/components/PositionCard.tsx` — modification

Add to the active position section only (not settled cards):

```
[existing card content]
─────────────────────────
📅 Add to calendar        ← small secondary button, bottom-left
```

Uses `buildCalendarUrl(position, assetSymbol)`. Opens in new tab (`target="_blank"`). No backend call.

### `src/components/RangePositionCard.tsx` — modification

Same treatment as `PositionCard`: add "📅 Add to calendar" to the active range card only. Both legs share the same expiry, so one calendar button for the pair is correct. Use the put leg's expiry and a combined title: `b1nary: ETH range expiry ($1,900–$2,100)`.

---

## API additions — `src/lib/api.ts`

```ts
getNotificationStatus: (wallet: string) =>
  fetchAPI<{ has_email: boolean; verified: boolean; unsubscribed: boolean }>(
    `/notifications/status?wallet=${wallet}`
  ),

submitEmail: (wallet: string, email: string) =>
  fetchAPI<{ ok: boolean }>("/notifications/email", {
    method: "POST",
    body: JSON.stringify({ wallet_address: wallet, email }),
  }),

verifyCode: (wallet: string, code: string) =>
  fetchAPI<{ ok: boolean }>("/notifications/verify", {
    method: "POST",
    body: JSON.stringify({ wallet_address: wallet, code }),
  }),

unsubscribe: (wallet: string) =>
  fetchAPI<{ ok: boolean }>("/notifications/unsubscribe", {
    method: "POST",
    body: JSON.stringify({ wallet_address: wallet }),
  }),
```

---

## Positions page — `src/app/positions/page.tsx`

1. Call `useNotificationStatus(address)` at page level.
2. Render `<NotificationBanner walletAddress={address} status={notifStatus} />` between `<PortfolioSummary>` and the "Active positions" section.
3. No changes to the history section.

---

## Shadcn components to install

```bash
bunx shadcn@latest add collapsible
bunx shadcn@latest add input-otp
bunx shadcn@latest add input
```

---

## Out of scope

- Email sending logic (backend, done in B1N-232)
- Calendar event updates post-settlement (not possible with static links)
- Notification preferences beyond on/off (no frequency, no asset filter)
- `/settings/notifications` page — manage is inline in banner

---

## Acceptance criteria

- [ ] Active position cards show "📅 Add to calendar" button
- [ ] Calendar URL has correct title, date (08:00 UTC), and description
- [ ] Banner hidden when backend unavailable
- [ ] Full email → code → verified flow works end to end
- [ ] Verified state shows email address and Manage button
- [ ] "Turn off" unsubscribes and resets banner to idle
- [ ] "Change email" reopens email form
- [ ] Privy linked email pre-fills the input when available
- [ ] No email UI on settled position cards
- [ ] `RangePositionCard` also shows calendar button on active ranges
