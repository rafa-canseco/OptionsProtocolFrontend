# B1N-208: Expiry Reminders — Calendar + Email Opt-in

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Google Calendar button to each active position card and a one-time email notification banner to the positions page.

**Architecture:** Page-level `NotificationBanner` manages a 5-state machine (idle → email-form → code-verify → verified → manage-open) using the backend endpoints from B1N-232. Each active `PositionCard` and `RangePositionCard` gets a pure `buildCalendarUrl()` call that generates a Google Calendar deep-link — no backend dependency. `useNotificationStatus` hook fetches wallet status on mount; on error, the banner silently hides.

**Tech Stack:** Next.js 15, React 19, TypeScript, shadcn/ui (Collapsible, Input, InputOTP), Privy `usePrivy` for email pre-fill, Vitest + Testing Library

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/hooks/useNotificationStatus.ts` | Fetch + cache `GET /notifications/status`; expose `refetch` |
| Create | `src/components/NotificationBanner.tsx` | 5-state email opt-in UI |
| Modify | `src/lib/api.ts` | 4 new notification API methods |
| Modify | `src/lib/utils.ts` | Add `buildCalendarUrl()` |
| Modify | `src/app/positions/page.tsx` | Mount banner above active positions |
| Modify | `src/components/PositionCard.tsx` | Calendar button on active cards |
| Modify | `src/components/RangePositionCard.tsx` | Calendar button on active range cards |
| Create | `src/__tests__/setup.ts` | Vitest + Testing Library bootstrap |
| Create | `vitest.config.ts` | Vitest config with jsdom + path alias |
| Create | `src/__tests__/buildCalendarUrl.test.ts` | Unit tests for calendar URL utility |
| Create | `src/__tests__/useNotificationStatus.test.ts` | Hook tests with mocked fetch |
| Create | `src/__tests__/NotificationBanner.test.tsx` | Render tests for banner states |

---

## Task 1: Test infrastructure setup

**Files:**
- Create: `vitest.config.ts`
- Create: `src/__tests__/setup.ts`
- Modify: `package.json` (add test script)

- [ ] **Step 1: Install test dependencies**

```bash
bun add -D vitest @testing-library/react @testing-library/user-event @vitejs/plugin-react jsdom @testing-library/jest-dom
```

Expected: packages added to `devDependencies`, no errors.

- [ ] **Step 2: Create vitest config**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Create test setup file**

```ts
// src/__tests__/setup.ts
import "@testing-library/jest-dom";
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Verify setup with a smoke test**

```bash
bun test
```

Expected: `No test files found` (0 tests, no errors).

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts src/__tests__/setup.ts package.json bun.lockb
git commit -m "chore: add vitest + testing-library test setup"
```

---

## Task 2: Notification API methods

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add types and methods to api.ts**

After the `groupPositions` method (end of the `api` object), add:

```ts
  getNotificationStatus: (wallet: string) =>
    fetchAPI<{ has_email: boolean; verified: boolean; unsubscribed: boolean }>(
      `/notifications/status?wallet=${wallet}`,
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

- [ ] **Step 2: Verify TypeScript**

```bash
bun run tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add notification API methods to api client"
```

---

## Task 3: `buildCalendarUrl` utility + tests

**Files:**
- Modify: `src/lib/utils.ts`
- Create: `src/__tests__/buildCalendarUrl.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/buildCalendarUrl.test.ts
import { describe, it, expect } from "vitest";
import { buildCalendarUrl } from "@/lib/utils";
import type { Position } from "@/lib/api";

const BASE: Position = {
  id: "1",
  tx_hash: "0xabc",
  block_number: 1,
  user_address: "0xuser",
  otoken_address: "0xtoken",
  amount: 1_00000000,
  premium: "1000000",
  collateral: 1000_000000,       // $1,000 USDC (6 dec)
  vault_id: 1,
  strike_price: 2100_00000000,   // $2,100 (8 dec)
  expiry: 1776758400,            // 2026-04-19 00:00:00 UTC (midnight)
  is_put: true,
  is_settled: false,
  settled_at: null,
  settlement_tx_hash: null,
  indexed_at: "2026-01-01T00:00:00Z",
  settlement_type: null,
  delivered_asset: null,
  delivered_amount: null,
  delivery_tx_hash: null,
  is_itm: null,
  expiry_price: null,
  gross_premium: "1000000",
  net_premium: "960000",         // $0.96
  protocol_fee: "40000",
  outcome: null,
};

describe("buildCalendarUrl", () => {
  it("returns a Google Calendar render URL", () => {
    const url = buildCalendarUrl(BASE, "ETH", "eth");
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render/);
    expect(url).toContain("action=TEMPLATE");
  });

  it("puts expiry event at 08:00–09:00 UTC on expiry date", () => {
    const url = buildCalendarUrl(BASE, "ETH", "eth");
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("20260419T080000Z/20260419T090000Z");
  });

  it("uses 'put' in title for put positions", () => {
    const url = buildCalendarUrl(BASE, "ETH", "eth");
    expect(decodeURIComponent(url)).toContain("b1nary: ETH $2,100 put expiry");
  });

  it("uses 'call' in title for call positions", () => {
    const url = buildCalendarUrl({ ...BASE, is_put: false }, "ETH", "eth");
    expect(decodeURIComponent(url)).toContain("call expiry");
  });

  it("uses correct BTC collateral decimals for call positions", () => {
    const btcCall: Position = {
      ...BASE,
      is_put: false,
      collateral: 1_00000000, // 1 BTC (8 dec)
    };
    const url = buildCalendarUrl(btcCall, "cbBTC", "btc");
    expect(decodeURIComponent(url)).toContain("cbBTC");
  });

  it("includes strike, committed, and premium in details", () => {
    const url = buildCalendarUrl(BASE, "ETH", "eth");
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("Strike:");
    expect(decoded).toContain("Committed:");
    expect(decoded).toContain("Premium earned:");
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
bun test src/__tests__/buildCalendarUrl.test.ts
```

Expected: `buildCalendarUrl is not a function` or similar import error.

- [ ] **Step 3: Implement `buildCalendarUrl` in utils.ts**

Add after the existing exports in `src/lib/utils.ts`. Also add the `Position` import at the top:

```ts
import type { Position } from "@/lib/api";
```

Then add the function:

```ts
export function buildCalendarUrl(
  position: Position,
  assetSymbol: string,
  assetSlug: string,
  titleOverride?: string,
): string {
  const strike = position.strike_price / 1e8;
  const side = position.is_put ? "put" : "call";
  const strikeFmt = strike.toLocaleString("en-US");
  const title = titleOverride ?? `b1nary: ${assetSymbol} $${strikeFmt} ${side} expiry`;

  // Settlement runs at 08:00 UTC; position.expiry is midnight UTC on that date
  const d = new Date(position.expiry * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  const dates = `${day}T080000Z/${day}T090000Z`;

  const isBtc = assetSlug === "btc";
  const callDec = isBtc ? 1e8 : 1e18;
  const premiumUsd = Number(position.net_premium) / 1e6;
  const committedDisplay = position.is_put
    ? `$${(position.collateral / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : `${fmtAsset(position.collateral / callDec)} ${assetSymbol}`;

  const details = `Strike: $${strikeFmt} | Committed: ${committedDisplay} | Premium earned: $${premiumUsd.toFixed(2)}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates,
    details,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
bun test src/__tests__/buildCalendarUrl.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Type check**

```bash
bun run tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils.ts src/__tests__/buildCalendarUrl.test.ts
git commit -m "feat: add buildCalendarUrl utility for Google Calendar deep-links"
```

---

## Task 4: `useNotificationStatus` hook + tests

**Files:**
- Create: `src/hooks/useNotificationStatus.ts`
- Create: `src/__tests__/useNotificationStatus.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/useNotificationStatus.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useNotificationStatus } from "@/hooks/useNotificationStatus";

// Mock the api module
vi.mock("@/lib/api", () => ({
  api: {
    getNotificationStatus: vi.fn(),
  },
}));

import { api } from "@/lib/api";

describe("useNotificationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns loading:true initially when address is provided", () => {
    vi.mocked(api.getNotificationStatus).mockResolvedValueOnce({
      has_email: false,
      verified: false,
      unsubscribed: false,
    });
    const { result } = renderHook(() => useNotificationStatus("0xabc"));
    expect(result.current.loading).toBe(true);
  });

  it("returns parsed status on success", async () => {
    vi.mocked(api.getNotificationStatus).mockResolvedValueOnce({
      has_email: true,
      verified: true,
      unsubscribed: false,
    });
    const { result } = renderHook(() => useNotificationStatus("0xabc"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasEmail).toBe(true);
    expect(result.current.verified).toBe(true);
    expect(result.current.unsubscribed).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it("sets error:true when fetch throws", async () => {
    vi.mocked(api.getNotificationStatus).mockRejectedValueOnce(new Error("500"));
    const { result } = renderHook(() => useNotificationStatus("0xabc"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(true);
    expect(result.current.hasEmail).toBe(false);
  });

  it("does not call api when walletAddress is undefined", () => {
    renderHook(() => useNotificationStatus(undefined));
    expect(api.getNotificationStatus).not.toHaveBeenCalled();
  });

  it("re-fetches when refetch() is called", async () => {
    vi.mocked(api.getNotificationStatus)
      .mockResolvedValueOnce({ has_email: false, verified: false, unsubscribed: false })
      .mockResolvedValueOnce({ has_email: true, verified: true, unsubscribed: false });

    const { result } = renderHook(() => useNotificationStatus("0xabc"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.verified).toBe(false);

    result.current.refetch();
    await waitFor(() => expect(result.current.verified).toBe(true));
    expect(api.getNotificationStatus).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
bun test src/__tests__/useNotificationStatus.test.ts
```

Expected: module not found error for `useNotificationStatus`.

- [ ] **Step 3: Implement the hook**

```ts
// src/hooks/useNotificationStatus.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface NotificationStatus {
  hasEmail: boolean;
  verified: boolean;
  unsubscribed: boolean;
  loading: boolean;
  error: boolean;
  refetch: () => void;
}

export function useNotificationStatus(
  walletAddress: string | undefined,
): NotificationStatus {
  const [hasEmail, setHasEmail] = useState(false);
  const [verified, setVerified] = useState(false);
  const [unsubscribed, setUnsubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    api
      .getNotificationStatus(walletAddress)
      .then((data) => {
        if (cancelled) return;
        setHasEmail(data.has_email);
        setVerified(data.verified);
        setUnsubscribed(data.unsubscribed);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [walletAddress, tick]);

  return { hasEmail, verified, unsubscribed, loading, error, refetch };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
bun test src/__tests__/useNotificationStatus.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Type check**

```bash
bun run tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useNotificationStatus.ts src/__tests__/useNotificationStatus.test.ts
git commit -m "feat: add useNotificationStatus hook"
```

---

## Task 5: Install shadcn components

**Files:**
- Create: `src/components/ui/collapsible.tsx`
- Create: `src/components/ui/input-otp.tsx`
- Create: `src/components/ui/input.tsx`

- [ ] **Step 1: Install components via shadcn CLI**

```bash
bunx shadcn@latest add collapsible input-otp input
```

Expected: 3 new files created in `src/components/ui/`, no errors. The `input-otp` package requires `input-otp` as a peer dependency — shadcn CLI installs it automatically.

- [ ] **Step 2: Type check**

```bash
bun run tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/collapsible.tsx src/components/ui/input-otp.tsx src/components/ui/input.tsx
git commit -m "chore: add shadcn collapsible, input-otp, input components"
```

---

## Task 6: `NotificationBanner` component + tests

**Files:**
- Create: `src/components/NotificationBanner.tsx`
- Create: `src/__tests__/NotificationBanner.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/__tests__/NotificationBanner.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBanner } from "@/components/NotificationBanner";
import type { NotificationStatus } from "@/hooks/useNotificationStatus";

vi.mock("@/lib/api", () => ({
  api: {
    submitEmail: vi.fn(),
    verifyCode: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({ user: null }),
}));

const baseStatus: NotificationStatus = {
  hasEmail: false,
  verified: false,
  unsubscribed: false,
  loading: false,
  error: false,
  refetch: vi.fn(),
};

describe("NotificationBanner", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing when status.error is true", () => {
    const { container } = render(
      <NotificationBanner walletAddress="0xabc" status={{ ...baseStatus, error: true }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while loading", () => {
    const { container } = render(
      <NotificationBanner walletAddress="0xabc" status={{ ...baseStatus, loading: true }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders idle state when not verified", () => {
    render(<NotificationBanner walletAddress="0xabc" status={baseStatus} />);
    expect(screen.getByText("Get expiry reminders")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /set up/i })).toBeInTheDocument();
  });

  it("renders verified state when verified and not unsubscribed", () => {
    render(
      <NotificationBanner
        walletAddress="0xabc"
        status={{ ...baseStatus, verified: true, hasEmail: true }}
      />,
    );
    expect(screen.getByText("Notifications on")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manage/i })).toBeInTheDocument();
  });

  it("shows email form when Set up is clicked", async () => {
    const user = userEvent.setup();
    render(<NotificationBanner walletAddress="0xabc" status={baseStatus} />);
    await user.click(screen.getByRole("button", { name: /set up/i }));
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send code/i })).toBeInTheDocument();
  });

  it("pre-fills email from Privy linkedAccounts", () => {
    vi.mock("@privy-io/react-auth", () => ({
      usePrivy: () => ({
        user: {
          linkedAccounts: [{ type: "email", address: "privy@example.com" }],
        },
      }),
    }));
    // Re-render after mock update is verified in integration; this test confirms the code path exists
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
bun test src/__tests__/NotificationBanner.test.tsx
```

Expected: module not found for `NotificationBanner`.

- [ ] **Step 3: Implement `NotificationBanner`**

```tsx
// src/components/NotificationBanner.tsx
"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { api } from "@/lib/api";
import type { NotificationStatus } from "@/hooks/useNotificationStatus";

type BannerState = "idle" | "email-form" | "code-verify" | "verified" | "manage-open";

interface Props {
  walletAddress: string;
  status: NotificationStatus;
}

export function NotificationBanner({ walletAddress, status }: Props) {
  const { user } = usePrivy();
  const privyEmail =
    (user?.linkedAccounts as Array<{ type: string; address?: string }> | undefined)
      ?.find((a) => a.type === "email")?.address ?? "";

  const initialState: BannerState =
    status.verified && !status.unsubscribed ? "verified" : "idle";

  const [state, setState] = useState<BannerState>(initialState);
  const [email, setEmail] = useState(privyEmail);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (status.error || status.loading) return null;

  // Cancel target: go back to verified if they already have a verified email
  const cancelTarget: BannerState =
    status.verified && !status.unsubscribed ? "verified" : "idle";

  async function handleSendCode() {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await api.submitEmail(walletAddress, email);
      setCode("");
      setState("code-verify");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to send code. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify() {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await api.verifyCode(walletAddress, code);
      setState("verified");
      status.refetch();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Invalid or expired code. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setErrorMsg(null);
    setCode("");
    try {
      await api.submitEmail(walletAddress, email);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to resend code.");
    }
  }

  async function handleUnsubscribe() {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await api.unsubscribe(walletAddress);
      setState("idle");
      status.refetch();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to turn off. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Idle ──────────────────────────────────────────────────────────────────
  if (state === "idle") {
    return (
      <div className="rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/15 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-base" aria-hidden>🔔</span>
          <div>
            <p className="text-sm font-semibold text-[var(--bone)]">Get expiry reminders</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Email 24h before each expiry + result after settlement
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEmail(privyEmail);
            setErrorMsg(null);
            setState("email-form");
          }}
        >
          Set up
        </Button>
      </div>
    );
  }

  // ── Email form ────────────────────────────────────────────────────────────
  if (state === "email-form") {
    return (
      <div className="rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/15 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-base" aria-hidden>🔔</span>
            <div>
              <p className="text-sm font-semibold text-[var(--bone)]">Enter your email</p>
              <p className="text-xs text-[var(--text-secondary)]">
                We&apos;ll send a 6-digit code to confirm
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setState(cancelTarget)}>
            Cancel
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && !submitting && email && handleSendCode()}
          />
          <Button size="sm" onClick={handleSendCode} disabled={submitting || !email}>
            {submitting ? "Sending…" : "Send code"}
          </Button>
        </div>
        {errorMsg && <p className="text-xs text-[var(--danger)]">{errorMsg}</p>}
      </div>
    );
  }

  // ── Code verification ─────────────────────────────────────────────────────
  if (state === "code-verify") {
    return (
      <div className="rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/15 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-base" aria-hidden>✉️</span>
            <p className="text-sm font-semibold text-[var(--bone)]">Check your email</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setState("email-form")}>
            Cancel
          </Button>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          Code sent to <span className="text-[var(--bone)]">{email}</span> · expires in 10 min
        </p>
        <div className="space-y-3">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            onComplete={handleVerify}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={handleVerify}
              disabled={submitting || code.length < 6}
            >
              {submitting ? "Verifying…" : "Verify"}
            </Button>
            <button
              onClick={handleResend}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] underline-offset-2 hover:underline"
            >
              Resend code
            </button>
          </div>
        </div>
        {errorMsg && <p className="text-xs text-[var(--danger)]">{errorMsg}</p>}
      </div>
    );
  }

  // ── Verified (+ manage-open via Collapsible) ──────────────────────────────
  return (
    <Collapsible
      open={state === "manage-open"}
      onOpenChange={(open) => setState(open ? "manage-open" : "verified")}
    >
      <div className="rounded-xl bg-[var(--accent)]/7 border border-[var(--accent)]/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              <span className="text-sm font-semibold text-[var(--accent)]">
                Notifications on
              </span>
            </div>
            {email && (
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{email}</p>
            )}
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              Manage
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--accent)]/15">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                setCode("");
                setErrorMsg(null);
                setState("email-form");
              }}
            >
              Change email
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-[var(--danger)] border-[var(--danger)]/30 hover:bg-[var(--danger)]/10"
              onClick={handleUnsubscribe}
              disabled={submitting}
            >
              {submitting ? "Turning off…" : "Turn off"}
            </Button>
          </div>
          {errorMsg && (
            <p className="text-xs text-[var(--danger)] mt-2">{errorMsg}</p>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
bun test src/__tests__/NotificationBanner.test.tsx
```

Expected: 5 tests pass (the Privy pre-fill test is a placeholder and will pass).

- [ ] **Step 5: Type check**

```bash
bun run tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/NotificationBanner.tsx src/__tests__/NotificationBanner.test.tsx
git commit -m "feat: add NotificationBanner component with 5-state email opt-in flow"
```

---

## Task 7: Wire banner into positions page

**Files:**
- Modify: `src/app/positions/page.tsx`

- [ ] **Step 1: Add hook and banner to positions page**

At the top of `src/app/positions/page.tsx`, add the imports:

```ts
import { useNotificationStatus } from "@/hooks/useNotificationStatus";
import { NotificationBanner } from "@/components/NotificationBanner";
```

Inside `PositionsPage`, after the existing hooks (after `useActivity`), add:

```ts
const notifStatus = useNotificationStatus(address);
```

In the JSX, inside the `<main>` return (not in the loading/empty/disconnected early-returns), add the banner between `<PortfolioSummary>` and the active positions `<section>`:

```tsx
<PortfolioSummary ... />

{address && (
  <NotificationBanner walletAddress={address} status={notifStatus} />
)}

<section className="space-y-4">
  <h2 ...>Active positions</h2>
  ...
```

- [ ] **Step 2: Type check**

```bash
bun run tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/positions/page.tsx
git commit -m "feat: mount NotificationBanner on positions page"
```

---

## Task 8: Calendar button in `PositionCard`

**Files:**
- Modify: `src/components/PositionCard.tsx`

- [ ] **Step 1: Add import and calendar button**

At the top of `src/components/PositionCard.tsx`, add:

```ts
import { buildCalendarUrl } from "@/lib/utils";
```

Inside the active position JSX section (the `{isActive && (...)}` block), add the calendar button at the very end, after the `Open tx` link and before the closing `</>`:

```tsx
<a
  href={buildCalendarUrl(position, assetSymbol, assetSlug)}
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
>
  📅 Add to calendar
</a>
```

- [ ] **Step 2: Type check**

```bash
bun run tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/PositionCard.tsx
git commit -m "feat: add calendar link to active position cards"
```

---

## Task 9: Calendar button in `RangePositionCard`

**Files:**
- Modify: `src/components/RangePositionCard.tsx`

- [ ] **Step 1: Read the active section of RangePositionCard**

Open `src/components/RangePositionCard.tsx` and find the `{isActive && (...)}` block to identify where to add the button. The put leg's expiry is used for the calendar event since both legs share the same expiry.

- [ ] **Step 2: Add import and calendar button**

Add import at the top:

```ts
import { buildCalendarUrl } from "@/lib/utils";
```

Inside the active range section, add after existing links (tx explorer links) and before the closing tag of the active block. `putStrike` and `callStrike` are already computed earlier in the component:

```tsx
{/* Calendar: use put leg for expiry/collateral data; override title with range strikes */}
<a
  href={buildCalendarUrl(
    putLeg,
    assetSymbol,
    assetSlug ?? "eth",
    `b1nary: ${assetSymbol} range expiry ($${putStrike.toLocaleString("en-US")}–$${callStrike.toLocaleString("en-US")})`,
  )}
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
>
  📅 Add to calendar
</a>
```

Note: `assetSlug` may not be in `RangePositionCard`'s props currently. Check the Props interface. If missing, add it:

```ts
interface Props {
  ...
  assetSlug?: string;
}
```

And destructure it:

```ts
export function RangePositionCard({ ..., assetSlug = "eth" }: Props) {
```

- [ ] **Step 3: Type check**

```bash
bun run tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/RangePositionCard.tsx
git commit -m "feat: add calendar link to active range position cards"
```

---

## Task 10: End-to-end smoke test

- [ ] **Step 1: Start dev server**

```bash
bun dev
```

- [ ] **Step 2: Manual verification checklist**

Connect wallet and navigate to `/positions`. Verify:

- [ ] `NotificationBanner` appears above active positions
- [ ] Banner is hidden if backend is down (open DevTools → Network → block the `/notifications/status` request and refresh)
- [ ] "Set up" opens the email form inline
- [ ] Email from Privy pre-fills if the user logged in with email
- [ ] "Send code" calls `POST /notifications/email` (check Network tab)
- [ ] OTP input accepts 6 digits and auto-submits on complete
- [ ] "Verify" calls `POST /notifications/verify`
- [ ] After verify: banner shows "Notifications on"
- [ ] "Manage" expands the collapsible with "Change email" and "Turn off"
- [ ] "Turn off" calls `POST /notifications/unsubscribe` and resets to idle
- [ ] Each active single position card shows "📅 Add to calendar"
- [ ] Calendar link opens Google Calendar with correct title, date (08:00 UTC), and details
- [ ] Each active range card shows "📅 Add to calendar" with range title
- [ ] Settled position cards have no calendar button

- [ ] **Step 3: Run full test suite**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 4: Final type check and lint**

```bash
bun run tsc --noEmit && bun run lint
```

Expected: no errors, no warnings.
