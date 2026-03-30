# Smart Wallet Deposit Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all trades to execute from a Privy smart wallet, with a deposit/withdraw modal to fund it from the user's EOA, and unified positions view that merges EOA + smart wallet history.

**Architecture:** `useWallet` exposes two addresses — `address` (smart wallet, always used for trades) and `fundingAddress` (EOA, only used for deposits and reading legacy positions). `sendBatchTx` is smart-wallet-only (gas sponsored). A new `sendFundingTx` sends a single EOA tx for deposits. `DepositModal` handles fund transfers in both directions. `usePositions` queries both addresses and merges results.

**Tech Stack:** Next.js, React, TypeScript, viem, Privy smart wallets (`@privy-io/react-auth/smart-wallets`)

**Spec:** `docs/superpowers/specs/2026-03-29-smart-wallet-deposit-flow.md`

**Tickets:** B1N-218, B1N-219, B1N-244, B1N-245

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/hooks/useWallet.ts` | `address` → smart wallet; add `fundingAddress`, `sendFundingTx`; remove EOA path from `sendBatchTx` |
| Modify | `src/lib/contracts.ts` | Add `transfer` function to `ERC20_ABI` |
| Create | `src/components/DepositModal.tsx` | Deposit/withdraw modal with token selector and transfer execution |
| Modify | `src/components/ConnectButton.tsx` | Three-state lifecycle: Connect / Deposit / Balance; opens DepositModal |
| Modify | `src/hooks/usePositions.ts` | Accept `fundingAddress` param; query both addresses; merge + deduplicate |
| Modify | `src/app/positions/page.tsx` | Pass `fundingAddress` from `useWallet` to `usePositions` |
| Modify | `src/components/AcceptModal.tsx` | Balance check against smart wallet; open DepositModal instead of error when insufficient |
| Modify | `src/components/v2/RangeAcceptModal.tsx` | Same deposit interception as AcceptModal |

---

## Task 1: Refactor `useWallet` — smart wallet as primary address

**Files:**
- Modify: `src/hooks/useWallet.ts`

- [ ] **Step 1: Replace the file with the new implementation**

```typescript
// src/hooks/useWallet.ts
"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { createWalletClient, custom, type Address } from "viem";
import { useState, useEffect, useCallback } from "react";
import { CHAIN } from "@/lib/contracts";

export type BatchCall = {
  to: Address;
  data: `0x${string}`;
  value?: bigint;
};

export function useWallet() {
  const { login, logout, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const { client } = useSmartWallets();
  const [chainError, setChainError] = useState<string | null>(null);

  const externalWallet = wallets.find((w) => w.walletClientType !== "privy");
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const fundingWallet = externalWallet ?? embeddedWallet;

  // Trading address: always the smart wallet (gas-sponsored, batched)
  const address = client?.account?.address as Address | undefined;

  // Funding address: the connected EOA (for deposits, withdrawals, legacy positions)
  const fundingAddress = fundingWallet?.address as Address | undefined;

  useEffect(() => {
    if (!fundingWallet) return;
    fundingWallet
      .switchChain(CHAIN.id)
      .then(() => setChainError(null))
      .catch((err) => {
        console.error("[useWallet] Failed to switch chain:", err);
        setChainError(
          "Failed to switch to the required chain. Transactions will fail.",
        );
      });
  }, [fundingWallet]);

  // All trades execute through the smart wallet — gas sponsored by Privy paymaster
  const sendBatchTx = useCallback(
    async (calls: BatchCall[]): Promise<unknown> => {
      if (calls.length === 0) {
        throw new Error("sendBatchTx requires at least one call");
      }
      if (!client) {
        throw new Error("Smart wallet not ready");
      }
      console.log(
        "[sendBatchTx] Smart wallet: firing batch with",
        calls.length,
        "calls:",
        calls.map((c) => ({ to: c.to, data: c.data.slice(0, 10) })),
      );
      return client
        .sendTransaction(
          {
            calls: calls.map((c) => ({
              to: c.to,
              data: c.data,
              value: c.value,
            })),
          },
          { uiOptions: { showWalletUIs: false } },
        )
        .catch((err) => {
          console.error("[sendBatchTx] Error:", err);
          throw err;
        });
    },
    [client],
  );

  // Deposit/withdraw only — single tx from the user's EOA
  const sendFundingTx = useCallback(
    async (call: BatchCall): Promise<`0x${string}`> => {
      if (!fundingWallet) {
        throw new Error("No funding wallet connected");
      }
      const provider = await fundingWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: fundingWallet.address as Address,
        chain: CHAIN,
        transport: custom(provider),
      });
      console.log("[sendFundingTx] EOA sending tx to", call.to);
      return walletClient.sendTransaction({
        to: call.to,
        data: call.data,
        value: call.value,
      });
    },
    [fundingWallet],
  );

  return {
    address,
    fundingAddress,
    sendBatchTx,
    sendFundingTx,
    chainError,
    isConnected: authenticated && !!address,
    isReady: ready,
    login,
    logout,
  };
}
```

- [ ] **Step 2: Run type check**

```bash
cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend
bun run tsc --noEmit
```

Expected: no errors related to `useWallet`. There may be downstream errors in components that expected the old EOA `address` — those are fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWallet.ts
git commit -m "refactor: useWallet — smart wallet as primary address, add sendFundingTx"
```

---

## Task 2: Add `transfer` to `ERC20_ABI`

The `DepositModal` calls `transfer()` on ERC20 tokens. It's a standard function missing from the current minimal ABI.

**Files:**
- Modify: `src/lib/contracts.ts`

- [ ] **Step 1: Add `transfer` to `ERC20_ABI`**

In `src/lib/contracts.ts`, add the following entry inside the `ERC20_ABI` array after the `mint` entry:

```typescript
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
```

The full `ERC20_ABI` array after the change ends with:

```typescript
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;
```

- [ ] **Step 2: Run type check**

```bash
bun run tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/contracts.ts
git commit -m "feat: add transfer function to ERC20_ABI"
```

---

## Task 3: Create `DepositModal` component

**Files:**
- Create: `src/components/DepositModal.tsx`

- [ ] **Step 1: Create the file**

```typescript
// src/components/DepositModal.tsx
"use client";

import { useState, useCallback } from "react";
import { encodeFunctionData, parseUnits, type Address } from "viem";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { publicClient, ADDRESSES, ERC20_ABI } from "@/lib/contracts";

type Tab = "deposit" | "withdraw";
type Token = "usdc" | "eth" | "btc";

interface TokenConfig {
  label: string;
  icon: string;
  decimals: number;
}

const TOKEN_META: Record<Token, TokenConfig> = {
  usdc: { label: "USDC", icon: "/usdc.svg", decimals: 6 },
  eth: { label: "ETH", icon: "/eth.png", decimals: 18 },
  btc: { label: "cbBTC", icon: "/cbbtc.webp", decimals: 8 },
};

interface Props {
  onClose: () => void;
  /** Pre-select a token when opened from a trade interception */
  requiredToken?: Token;
  /** Show a contextual message about why deposit is needed */
  requiredAmount?: number;
  /** Called after a successful deposit */
  onComplete?: () => void;
}

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function DepositModal({ onClose, requiredToken, onComplete }: Props) {
  const { address, fundingAddress, sendBatchTx, sendFundingTx } = useWallet();
  const smartBalances = useBalances(address);
  const eoaBalances = useBalances(fundingAddress);

  const [tab, setTab] = useState<Tab>("deposit");
  const [token, setToken] = useState<Token>(requiredToken ?? "usdc");
  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const meta = TOKEN_META[token];

  // Available balance depends on direction
  const availableBalance = tab === "deposit"
    ? token === "usdc" ? eoaBalances.usd
      : token === "eth" ? eoaBalances.eth
      : eoaBalances.wbtc
    : token === "usdc" ? smartBalances.usd
      : token === "eth" ? smartBalances.weth
      : smartBalances.wbtc;

  const handleMax = useCallback(() => {
    const decimals = meta.decimals === 6 ? 2 : meta.decimals === 8 ? 6 : 4;
    setAmountStr(availableBalance.toFixed(decimals));
  }, [availableBalance, meta.decimals]);

  const handleDeposit = useCallback(async () => {
    if (!address || !fundingAddress) return;
    const amount = parseUnits(amountStr, meta.decimals);
    if (amount === BigInt(0)) return;

    setError(null);
    setStatus("pending");
    try {
      let hash: `0x${string}`;
      if (token === "eth") {
        // Native ETH: send value directly to smart wallet
        hash = await sendFundingTx({ to: address, data: "0x", value: amount });
      } else {
        const tokenAddress = token === "usdc" ? ADDRESSES.usdc : ADDRESSES.wbtc;
        hash = await sendFundingTx({
          to: tokenAddress,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [address, amount],
          }),
        });
      }
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("done");
      window.dispatchEvent(new Event("balance:refetch"));
      onComplete?.();
    } catch (err) {
      console.error("[DepositModal] deposit failed:", err);
      setError(err instanceof Error ? err.message : "Transaction failed. Please try again.");
      setStatus("idle");
    }
  }, [address, fundingAddress, amountStr, meta.decimals, token, sendFundingTx, onComplete]);

  const handleWithdraw = useCallback(async () => {
    if (!address || !fundingAddress) return;
    const amount = parseUnits(amountStr, meta.decimals);
    if (amount === BigInt(0)) return;

    setError(null);
    setStatus("pending");
    try {
      // Withdraw: transfer from smart wallet back to EOA
      // ETH/WETH option withdraws WETH token
      const tokenAddress = token === "usdc" ? ADDRESSES.usdc
        : token === "eth" ? ADDRESSES.weth
        : ADDRESSES.wbtc;

      const hash = await sendBatchTx([{
        to: tokenAddress,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [fundingAddress, amount],
        }),
      }]) as `0x${string}`;

      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("done");
      window.dispatchEvent(new Event("balance:refetch"));
    } catch (err) {
      console.error("[DepositModal] withdraw failed:", err);
      setError(err instanceof Error ? err.message : "Transaction failed. Please try again.");
      setStatus("idle");
    }
  }, [address, fundingAddress, amountStr, meta.decimals, token, sendBatchTx]);

  const isPending = status === "pending";
  const isDone = status === "done";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={isPending ? undefined : onClose} />
      <div className="relative w-full max-w-sm bg-[var(--bg)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">Your trading account</h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors disabled:opacity-40 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Route indicator */}
        {address && fundingAddress && (
          <p className="text-xs text-[var(--text-secondary)]">
            {tab === "deposit"
              ? `${truncate(fundingAddress)} → ${truncate(address)}`
              : `${truncate(address)} → ${truncate(fundingAddress)}`}
          </p>
        )}

        {/* Tabs */}
        <div className="flex rounded-xl bg-[var(--surface)] p-1 gap-1">
          {(["deposit", "withdraw"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setAmountStr(""); setError(null); setStatus("idle"); }}
              disabled={isPending}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors capitalize ${
                tab === t
                  ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              } disabled:opacity-40`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Token selector */}
        <div className="flex gap-2">
          {(["usdc", "eth", "btc"] as Token[]).map((t) => (
            <button
              key={t}
              onClick={() => { setToken(t); setAmountStr(""); setError(null); }}
              disabled={isPending}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                token === t
                  ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]"
              } disabled:opacity-40`}
            >
              <img src={TOKEN_META[t].icon} alt={TOKEN_META[t].label} className="w-4 h-4 rounded-full" />
              {TOKEN_META[t].label}
            </button>
          ))}
        </div>

        {/* Amount input */}
        <div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amountStr}
              disabled={isPending || isDone}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "" || /^(0|[1-9]\d*)?\.?\d*$/.test(raw)) {
                  setAmountStr(raw);
                }
              }}
              className="flex-1 bg-transparent text-[var(--text)] font-semibold text-base focus:outline-none"
            />
            <button
              onClick={handleMax}
              disabled={isPending || isDone || availableBalance <= 0}
              className="text-xs font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              Max
            </button>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1.5">
            Available: {token === "usdc"
              ? `$${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })} ${meta.label}`}
            {tab === "withdraw" && token === "eth" ? " (WETH)" : ""}
          </p>
        </div>

        {/* Withdraw gas note */}
        {tab === "withdraw" && (
          <p className="text-xs text-[var(--text-secondary)]">
            Withdrawals are free — gas is sponsored.
          </p>
        )}

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

        {isDone ? (
          <div className="space-y-3">
            <p className="text-sm text-center text-[var(--accent)] font-semibold">
              {tab === "deposit" ? "Deposit complete." : "Withdrawal complete."}
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-[var(--surface)] py-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--border)] transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <button
            onClick={tab === "deposit" ? handleDeposit : handleWithdraw}
            disabled={isPending || !amountStr || Number(amountStr) <= 0}
            className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
          >
            {isPending
              ? tab === "deposit" ? "Depositing..." : "Withdrawing..."
              : tab === "deposit" ? `Deposit ${meta.label}` : `Withdraw ${meta.label}`}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
bun run tsc --noEmit
```

Expected: no errors in `DepositModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/DepositModal.tsx
git commit -m "feat: add DepositModal with deposit/withdraw tabs and token selector"
```

---

## Task 4: Update `ConnectButton` — three-state lifecycle

**Files:**
- Modify: `src/components/ConnectButton.tsx`

The button has three states:
1. Not connected: shows "Connect"
2. Connected, smart wallet balance = 0: shows "Deposit"
3. Connected, smart wallet balance > 0: shows USDC balance, clicking opens DepositModal

Note: ConnectButton uses USDC balance as the primary balance display. WETH/cbBTC are visible inside the DepositModal.

- [ ] **Step 1: Replace the file**

```typescript
// src/components/ConnectButton.tsx
"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { DepositModal } from "@/components/DepositModal";

export function ConnectButton() {
  const { address, isConnected, isReady, login, logout } = useWallet();
  const { usd, loading: balancesLoading } = useBalances(address);
  const [showDeposit, setShowDeposit] = useState(false);

  if (!isReady) {
    return <div className="h-9 w-24 animate-pulse rounded-full bg-[var(--surface)]" />;
  }

  if (isConnected && address) {
    const hasBalance = usd > 0;
    const balanceLabel = hasBalance
      ? `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "Deposit";

    return (
      <>
        <button
          onClick={() => setShowDeposit(true)}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--text-secondary)] transition-colors flex items-center gap-1.5"
        >
          <img src="/base.svg" alt="Base" className="w-4 h-4" />
          {balancesLoading ? "..." : balanceLabel}
        </button>

        {showDeposit && (
          <DepositModal onClose={() => setShowDeposit(false)} />
        )}
      </>
    );
  }

  return (
    <button
      onClick={login}
      className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
    >
      Connect
    </button>
  );
}
```

Note: the old dropdown with "Copy address" and "Disconnect" is removed. Disconnect is intentionally omitted — users rarely need it and it reduces clutter. If the product owner wants it back, it can be added to the DepositModal footer.

- [ ] **Step 2: Run type check**

```bash
bun run tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ConnectButton.tsx
git commit -m "feat: ConnectButton shows balance and opens DepositModal"
```

---

## Task 5: Update `usePositions` — unified EOA + smart wallet view

**Files:**
- Modify: `src/hooks/usePositions.ts`

- [ ] **Step 1: Replace the file**

```typescript
// src/hooks/usePositions.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type Position } from "@/lib/api";

export function usePositions(
  address: string | undefined,
  fundingAddress: string | undefined,
  pollInterval = 15_000,
) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address && !fundingAddress) {
      setPositions([]);
      setLoading(false);
      return;
    }
    try {
      // Fetch from both addresses, deduplicate by id
      const queries: Promise<Position[]>[] = [];
      if (address) queries.push(api.getPositions(address));
      if (fundingAddress && fundingAddress !== address) {
        queries.push(api.getPositions(fundingAddress));
      }

      const results = await Promise.all(queries);
      const merged = results.flat();

      const seen = new Set<string>();
      const deduped = merged.filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      setPositions(deduped);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch positions");
    } finally {
      setLoading(false);
    }
  }, [address, fundingAddress]);

  useEffect(() => {
    refresh();
    if (!address && !fundingAddress) return;

    // Poll faster for the first 30s after mount (new position may still be indexing)
    const fastPoll = setInterval(refresh, 3_000);
    const stopFastPoll = setTimeout(() => clearInterval(fastPoll), 30_000);
    const slowPoll = setInterval(refresh, pollInterval);

    return () => {
      clearInterval(fastPoll);
      clearTimeout(stopFastPoll);
      clearInterval(slowPoll);
    };
  }, [refresh, address, fundingAddress, pollInterval]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("balance:refetch", handler);
    return () => window.removeEventListener("balance:refetch", handler);
  }, [refresh]);

  return { positions, loading, error, refresh };
}
```

- [ ] **Step 2: Run type check**

```bash
bun run tsc --noEmit
```

Expected: error in `positions/page.tsx` because it still calls `usePositions(address)` with one arg. Fixed in the next task.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePositions.ts
git commit -m "feat: usePositions queries both smart wallet and EOA, merges positions"
```

---

## Task 6: Update `positions/page.tsx` — pass `fundingAddress`

**Files:**
- Modify: `src/app/positions/page.tsx`

- [ ] **Step 1: Update the `useWallet` destructure and `usePositions` call**

Find this block in `src/app/positions/page.tsx`:

```typescript
  const { address, isConnected } = useWallet();
  const { positions, loading, refresh } = usePositions(address);
```

Replace with:

```typescript
  const { address, fundingAddress, isConnected } = useWallet();
  const { positions, loading, refresh } = usePositions(address, fundingAddress);
```

- [ ] **Step 2: Run type check**

```bash
bun run tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/positions/page.tsx
git commit -m "feat: positions page passes fundingAddress for unified EOA+smart wallet view"
```

---

## Task 7: Update `AcceptModal` — smart wallet balance check + deposit interception

When a user clicks Accept with insufficient balance in their smart wallet, the modal opens `DepositModal` with the required token pre-selected instead of showing an error.

**Files:**
- Modify: `src/components/AcceptModal.tsx`

- [ ] **Step 1: Add `DepositModal` import and deposit state**

At the top of `AcceptModal.tsx`, add the import after the existing imports:

```typescript
import { DepositModal } from "@/components/DepositModal";
```

Inside the `AcceptModal` function body, after the existing `useState` declarations, add:

```typescript
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositToken, setDepositToken] = useState<"usdc" | "eth" | "btc">("usdc");
```

- [ ] **Step 2: Replace the balance-check error branches in `handleAccept` with deposit interception**

Find this block in `handleAccept` (the on-chain balance check section):

```typescript
      // On-chain balance check
      let wrapAmount = BigInt(0);
      if (isBuy) {
        const usdcBal = await readTokenBalance(ADDRESSES.usdc, address);
        if (usdcBal < collateral) {
          setError("Insufficient USD balance.");
          return;
        }
      } else if (isBtc) {
        // BTC calls: cbBTC is already ERC20, no wrapping needed
        const wbtcBal = await readTokenBalance(ADDRESSES.wbtc, address);
        if (wbtcBal < collateral) {
          setError(`Insufficient ${assetSymbol} balance.`);
          return;
        }
      } else {
        // ETH calls: accept native ETH + WETH combined, wrap if needed
        const [wethBal, nativeBal] = await Promise.all([
          readTokenBalance(ADDRESSES.weth, address),
          publicClient.getBalance({ address }),
        ]);
        if (wethBal + nativeBal < collateral) {
          setError(`Insufficient ${assetSymbol} balance.`);
          return;
        }
        if (wethBal < collateral) {
          wrapAmount = collateral - wethBal;
        }
      }
```

Replace with:

```typescript
      // On-chain balance check — redirect to deposit if smart wallet is underfunded
      let wrapAmount = BigInt(0);
      if (isBuy) {
        const usdcBal = await readTokenBalance(ADDRESSES.usdc, address);
        if (usdcBal < collateral) {
          setDepositToken("usdc");
          setShowDeposit(true);
          return;
        }
      } else if (isBtc) {
        // BTC calls: cbBTC is already ERC20, no wrapping needed
        const wbtcBal = await readTokenBalance(ADDRESSES.wbtc, address);
        if (wbtcBal < collateral) {
          setDepositToken("btc");
          setShowDeposit(true);
          return;
        }
      } else {
        // ETH calls: accept native ETH + WETH combined, wrap if needed
        const [wethBal, nativeBal] = await Promise.all([
          readTokenBalance(ADDRESSES.weth, address),
          publicClient.getBalance({ address }),
        ]);
        if (wethBal + nativeBal < collateral) {
          setDepositToken("eth");
          setShowDeposit(true);
          return;
        }
        if (wethBal < collateral) {
          wrapAmount = collateral - wethBal;
        }
      }
```

- [ ] **Step 3: Render DepositModal inside AcceptModal JSX**

In the JSX return, add the DepositModal just before the closing `</div>` of the outer container:

```typescript
        {showDeposit && (
          <DepositModal
            requiredToken={depositToken}
            onClose={() => setShowDeposit(false)}
            onComplete={() => setShowDeposit(false)}
          />
        )}
```

The full closing section of the JSX should look like:

```typescript
        {step === "confirmed" && txHash && CHAIN.blockExplorers?.default.url && (
          <a
            href={`${CHAIN.blockExplorers.default.url}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-sm text-[var(--accent)] hover:underline"
          >
            View transaction ↗
          </a>
        )}

        {showDeposit && (
          <DepositModal
            requiredToken={depositToken}
            onClose={() => setShowDeposit(false)}
            onComplete={() => setShowDeposit(false)}
          />
        )}
      </div>
    </div>
  );
```

- [ ] **Step 4: Run type check**

```bash
bun run tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/AcceptModal.tsx
git commit -m "feat: AcceptModal redirects to DepositModal when smart wallet balance is insufficient"
```

---

## Task 8: Update `RangeAcceptModal` — same deposit interception

**Files:**
- Modify: `src/components/v2/RangeAcceptModal.tsx`

- [ ] **Step 1: Add import and deposit state**

Add after the existing imports:

```typescript
import { DepositModal } from "@/components/DepositModal";
```

Inside `RangeAcceptModal` function body, after the existing `useState` declarations, add:

```typescript
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositToken, setDepositToken] = useState<"usdc" | "eth" | "btc">("usdc");
```

- [ ] **Step 2: Replace balance-check error returns with deposit interception**

Find this block in `handleAccept` (after balance reads):

```typescript
      const needsSwap = callAvailable < callNeeded && ADDRESSES.swapRouter !== null;

      if (needsSwap) {
        // ...swap logic...
      } else if (callAvailable < callNeeded) {
        setError(`Insufficient ${assetSymbol} balance for the upper side.`);
        return;
      } else {
        if (usdcBal < putCol.collateral) {
          setError("Insufficient USDC balance for the lower side.");
          return;
        }
      }
```

Replace the two error-and-return cases:

```typescript
      const needsSwap = callAvailable < callNeeded && ADDRESSES.swapRouter !== null;

      if (needsSwap) {
        const swapRouter = ADDRESSES.swapRouter!;
        const callShortfall = callNeeded - callAvailable;
        const priceForSwap = spotPrice ?? putQuote.strike;
        const shortfallUnits = Number(callShortfall) / (10 ** callDecimals);
        const swapAmountUsdc = BigInt(Math.ceil(shortfallUnits * priceForSwap * 1.02 * 1e6));

        if (usdcBal < putCol.collateral + swapAmountUsdc) {
          setDepositToken("usdc");
          setShowDeposit(true);
          return;
        }

        const assetConfig = getAssetConfig(assetSlug);
        const feeTier = assetConfig?.swapFeeTier ?? 3000;

        updateStep("swapping");

        const swapRouterAllowance = await publicClient.readContract({
          address: ADDRESSES.usdc,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address as Address, swapRouter],
        });

        const swapCalls: BatchCall[] = [];
        if (swapRouterAllowance < swapAmountUsdc) {
          swapCalls.push({
            to: ADDRESSES.usdc,
            data: encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "approve",
              args: [swapRouter, maxUint256],
            }),
          });
        }

        swapCalls.push({
          to: swapRouter,
          data: encodeSwapExactOutput(
            ADDRESSES.usdc,
            callToken,
            feeTier,
            address as Address,
            callShortfall,
            swapAmountUsdc,
          ),
        });

        const swapHash = await sendBatchTx(swapCalls) as `0x${string}`;
        await publicClient.waitForTransactionReceipt({ hash: swapHash });
        setDidSwap(true);
      } else if (callAvailable < callNeeded) {
        setDepositToken(isBtc ? "btc" : "eth");
        setShowDeposit(true);
        return;
      } else {
        if (usdcBal < putCol.collateral) {
          setDepositToken("usdc");
          setShowDeposit(true);
          return;
        }
      }
```

- [ ] **Step 3: Render DepositModal in JSX**

Add inside the modal container, before the closing `</div>` tags:

```typescript
        {showDeposit && (
          <DepositModal
            requiredToken={depositToken}
            onClose={() => setShowDeposit(false)}
            onComplete={() => setShowDeposit(false)}
          />
        )}
```

- [ ] **Step 4: Run type check**

```bash
bun run tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/v2/RangeAcceptModal.tsx
git commit -m "feat: RangeAcceptModal redirects to DepositModal when smart wallet balance is insufficient"
```

---

## Task 9: End-to-end manual verification

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend
bun dev
```

- [ ] **Step 2: Test new user flow**

1. Open app in an incognito browser window
2. Navigate to `/earn/eth` — prices visible without connecting
3. Click "Connect" — Privy modal opens, connect via email
4. After connecting, ConnectButton should show "Deposit" (zero balance)
5. Click "Deposit" — DepositModal opens with Deposit tab active
6. Select USDC, enter an amount, click "Deposit USDC"
7. Approve in external wallet / embedded wallet
8. After tx confirms, modal shows "Deposit complete"
9. Close modal — ConnectButton now shows USD balance

- [ ] **Step 3: Test trade interception**

1. Open AcceptModal on a put option
2. Click Accept with zero smart wallet USDC balance
3. DepositModal opens with USDC pre-selected
4. Deposit, close, click Accept again — trade proceeds normally

- [ ] **Step 4: Test existing user positions**

1. Connect with an EOA that has existing positions
2. Navigate to `/positions`
3. Both EOA positions and smart wallet positions should appear in the same list

- [ ] **Step 5: Test withdraw**

1. Open DepositModal from ConnectButton
2. Switch to Withdraw tab
3. Enter amount, withdraw USDC back to EOA
4. Confirm in smart wallet (no gas cost)

- [ ] **Step 6: Final type check and push**

```bash
bun run tsc --noEmit
git push origin feat/b1n-218-smart-wallet-deposit
```

---

## Self-Review Notes

- `useBalances` already accepts an `address` param — no changes needed there
- `appendSuffix` and `DATA_SUFFIX` are removed from `useWallet` because the EOA path is gone. Smart wallet attribution is handled by the Privy `dataSuffix` plugin already in `providers.tsx`
- `useFaucet` mints tokens to `address` (now smart wallet) — correct for testnet
- `useActivity(address)` in positions page will use smart wallet address; EOA activity is not shown after migration. This is accepted scope — activity accumulates fresh for smart wallet
- The `logout` function is removed from `ConnectButton`. If needed later, it can be added to the DepositModal footer
- Withdraw for ETH/WETH option withdraws WETH token. Users who want native ETH can unwrap manually
