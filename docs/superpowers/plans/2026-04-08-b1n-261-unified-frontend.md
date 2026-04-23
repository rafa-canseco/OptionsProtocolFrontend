# B1N-261: Unified Balance, Positions, and Trade Routing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SOL market support with unified cross-chain balance, positions, and transparent trade routing between Base and Solana.

**Architecture:** Extend the asset registry with a `chain` field, add a direct Solana execution path using Privy's gas-sponsored `signAndSendTransaction`, extend balance hooks for wSOL + native SOL, and merge positions from both chains.

**Tech Stack:** Next.js, React, TypeScript, Privy (`@privy-io/react-auth/solana`), `@solana/web3.js`, `@solana/spl-token`, viem

**Spec:** `docs/superpowers/specs/2026-04-08-b1n-261-unified-frontend-design.md`

---

### Task 1: Asset Registry — Add SOL, generalize collateral

**Files:**
- Modify: `src/lib/assets.ts`

- [ ] **Step 1: Add `chain` and `collateralDecimals` to `AssetConfig` and add SOL**

```typescript
// src/lib/assets.ts

export interface AssetConfig {
  slug: string;
  symbol: string;
  name: string;
  wrappedSymbol: string;
  stableSymbol: string;
  maxAmount: number;
  maxAmountUsd: number;
  amountPlaceholder: string;
  displayDecimals: number;
  comingSoon?: boolean;
  swapFeeTier?: number;
  minSellAmount: number;
  minBuyAmountUsd: number;
  /** Which chain this asset trades on */
  chain: "base" | "solana";
  /** Decimals of the wrapped collateral token for calls */
  collateralDecimals: number;
}

export const ASSETS: Record<string, AssetConfig> = {
  eth: {
    slug: "eth",
    symbol: "ETH",
    name: "Ethereum",
    wrappedSymbol: "WETH",
    stableSymbol: "USDC",
    maxAmount: 1_000,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "0.5",
    displayDecimals: 4,
    swapFeeTier: 3000,
    minSellAmount: 0.005,
    minBuyAmountUsd: 10,
    chain: "base",
    collateralDecimals: 18,
  },
  btc: {
    slug: "btc",
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    wrappedSymbol: "cbBTC",
    stableSymbol: "USDC",
    maxAmount: 100,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "0.01",
    displayDecimals: 6,
    swapFeeTier: 500,
    minSellAmount: 0.0001,
    minBuyAmountUsd: 10,
    chain: "base",
    collateralDecimals: 8,
  },
  sol: {
    slug: "sol",
    symbol: "SOL",
    name: "Solana",
    wrappedSymbol: "wSOL",
    stableSymbol: "USDC",
    maxAmount: 10_000,
    maxAmountUsd: 1_000_000,
    amountPlaceholder: "10",
    displayDecimals: 4,
    minSellAmount: 0.1,
    minBuyAmountUsd: 10,
    chain: "solana",
    collateralDecimals: 9,
  },
};
```

Remove the `aero` and `virtual` entries entirely — they are dead code with `comingSoon: true` and nothing uses them.

- [ ] **Step 2: Update `resolvePositionAsset` for SOL**

Replace the existing function body:

```typescript
export function resolvePositionAsset(
  asset?: string,
  strikePrice?: number,
): AssetConfig {
  if (asset) {
    const config = ASSETS[asset.toLowerCase()];
    if (config) return config;
  }
  if (strikePrice != null) {
    const strikeUsd = strikePrice / 1e8;
    if (strikeUsd > 10_000) return ASSETS.btc;
    if (strikeUsd < 500) return ASSETS.sol;
    return ASSETS.eth;
  }
  return ASSETS[DEFAULT_ASSET];
}
```

Note: The strike heuristic (`< 500 = SOL`) is a fallback. The backend should always set the `asset` field — this covers old positions only.

- [ ] **Step 3: Verify build**

Run: `cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend && bun run build 2>&1 | head -30`

Any file importing `AssetConfig` that doesn't supply the new required fields will fail. Fix all callsites.

- [ ] **Step 4: Commit**

```bash
git add src/lib/assets.ts
git commit -m "feat(assets): add SOL config with chain and collateralDecimals"
```

---

### Task 2: Solana config — wSOL mint, explorer URL

**Files:**
- Modify: `src/lib/solana.ts`

- [ ] **Step 1: Add wSOL mint and explorer constants**

Add after the existing `SOLANA_CHAIN` export:

```typescript
/** Native SOL mint address — used as wSOL when wrapped into SPL token */
export const SOLANA_WSOL_MINT =
  "So11111111111111111111111111111111111111112";

/** Block explorer for Solana transaction links */
export const SOLANA_EXPLORER_URL =
  process.env.NEXT_PUBLIC_SOLANA_EXPLORER_URL ??
  "https://solscan.io";
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/solana.ts
git commit -m "feat(solana): add wSOL mint and explorer URL constants"
```

---

### Task 3: Generalize `computeCollateral`

**Files:**
- Modify: `src/lib/execution.ts`

- [ ] **Step 1: Replace hardcoded branches with formula**

Current code in `computeCollateral` (sell side):

```typescript
const isBtc = assetSlug === "btc";
const collateral = isBtc ? oTokenAmount : oTokenAmount * BigInt(1e10);
const collateralAsset = isBtc ? ADDRESSES.wbtc : ADDRESSES.weth;
```

Replace with:

```typescript
import { getAssetConfig } from "@/lib/assets";

// ... inside computeCollateral, sell side:
const config = getAssetConfig(assetSlug);
const scale = BigInt(10) ** BigInt((config?.collateralDecimals ?? 18) - 8);
const collateral = oTokenAmount * scale;
const collateralAsset = assetSlug === "btc" ? ADDRESSES.wbtc : ADDRESSES.weth;
```

`collateralAsset` is only used for EVM balance checks. For SOL, the Solana execution branch returns before it's used — so ADDRESSES.weth as fallback is fine.

- [ ] **Step 2: Verify the formula matches existing behavior**

```
ETH:  collateralDecimals=18 → scale = 10^10 → oTokenAmount * 10^10  ✓ (was: oTokenAmount * BigInt(1e10))
BTC:  collateralDecimals=8  → scale = 10^0 = 1 → oTokenAmount        ✓ (was: isBtc ? oTokenAmount)
SOL:  collateralDecimals=9  → scale = 10^1 = 10 → oTokenAmount * 10  ✓ (new)
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend && bun run build 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add src/lib/execution.ts
git commit -m "refactor(execution): generalize collateral scaling via collateralDecimals"
```

---

### Task 4: Extend Solana balance hook — wSOL + native SOL

**Files:**
- Modify: `src/hooks/useSolanaBalance.ts`

- [ ] **Step 1: Add wSOL and native SOL fields to the interface and fetch**

Replace the entire file with:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  solanaConnection,
  SOLANA_USDC_MINT,
  SOLANA_WSOL_MINT,
  toPublicKey,
} from "@/lib/solana";

interface SolanaBalance {
  solanaUsdcRaw: bigint;
  solanaUsdc: number;
  solanaWsolRaw: bigint;
  solanaWsol: number;
  solanaSolRaw: bigint;
  solanaSol: number;
  loading: boolean;
  error: string | null;
}

const ZERO: SolanaBalance = {
  solanaUsdcRaw: BigInt(0),
  solanaUsdc: 0,
  solanaWsolRaw: BigInt(0),
  solanaWsol: 0,
  solanaSolRaw: BigInt(0),
  solanaSol: 0,
  loading: true,
  error: null,
};

export function useSolanaBalance(
  address: string | undefined,
  pollInterval = 15_000,
): SolanaBalance {
  const [balance, setBalance] = useState<SolanaBalance>(ZERO);

  const refetch = useCallback(async () => {
    if (!address || !SOLANA_USDC_MINT || !solanaConnection) {
      setBalance({ ...ZERO, loading: false });
      return;
    }
    try {
      const owner = toPublicKey(address, "wallet address");
      const usdcMint = toPublicKey(SOLANA_USDC_MINT, "USDC mint");
      const wsolMint = toPublicKey(SOLANA_WSOL_MINT, "wSOL mint");

      const [usdcResp, wsolResp, solLamports] = await Promise.all([
        solanaConnection.getParsedTokenAccountsByOwner(owner, {
          mint: usdcMint,
        }),
        solanaConnection.getParsedTokenAccountsByOwner(owner, {
          mint: wsolMint,
        }),
        solanaConnection.getBalance(owner),
      ]);

      let usdcRaw = BigInt(0);
      for (const { account } of usdcResp.value) {
        const info = account.data.parsed?.info;
        if (info?.tokenAmount?.amount) {
          usdcRaw += BigInt(info.tokenAmount.amount);
        }
      }

      let wsolRaw = BigInt(0);
      for (const { account } of wsolResp.value) {
        const info = account.data.parsed?.info;
        if (info?.tokenAmount?.amount) {
          wsolRaw += BigInt(info.tokenAmount.amount);
        }
      }

      const solRaw = BigInt(solLamports);

      setBalance({
        solanaUsdcRaw: usdcRaw,
        solanaUsdc: Number(usdcRaw) / 1e6,
        solanaWsolRaw: wsolRaw,
        solanaWsol: Number(wsolRaw) / 1e9,
        solanaSolRaw: solRaw,
        solanaSol: Number(solRaw) / 1e9,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error("[useSolanaBalance] Failed to fetch:", err);
      setBalance((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to fetch Solana balance",
      }));
    }
  }, [address]);

  useEffect(() => {
    refetch();
    if (!address) return;
    const id = setInterval(refetch, pollInterval);
    return () => clearInterval(id);
  }, [refetch, address, pollInterval]);

  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener("balance:refetch", handler);
    return () => window.removeEventListener("balance:refetch", handler);
  }, [refetch]);

  return balance;
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend && bun run build 2>&1 | head -30`

Check that all consumers of `useSolanaBalance` still work. The old return type was a subset of the new one, so no breaking changes.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSolanaBalance.ts
git commit -m "feat(balance): extend Solana balance hook with wSOL and native SOL"
```

---

### Task 5: Add `sendSolanaTransaction` to wallet hook

**Files:**
- Modify: `src/hooks/useWallet.ts`

- [ ] **Step 1: Add gas-sponsored `sendSolanaTransaction` method**

The hook already imports `useSignAndSendTransaction` from `@privy-io/react-auth/solana` (line 7) and destructures `signAndSendTransaction` (line 59). Add a new method after `signSolanaTransaction`:

```typescript
// Gas-sponsored Solana trade execution (equivalent of sendBatchTx for Base)
const sendSolanaTransaction = useCallback(
  async (tx: Transaction): Promise<string> => {
    if (!solanaEmbedded) {
      throw new Error("Solana embedded wallet not ready");
    }
    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const result = await signAndSendTransaction({
      transaction: serialized,
      wallet: solanaEmbedded,
      options: { sponsor: true },
    });
    return result.signature;
  },
  [solanaEmbedded, signAndSendTransaction],
);
```

Add `sendSolanaTransaction` to the return object:

```typescript
return {
  address,
  fundingAddress,
  solanaAddress,
  externalWallets: externalWalletsList,
  sendBatchTx,
  sendFundingTx,
  sendSolanaDeposit,
  sendSolanaTransaction,   // NEW
  signSolanaTransaction,
  chainError,
  isConnected: !!fundingAddress,
  isReady: ready,
  connectWallet,
  activateSmartWallet,
  disconnect,
};
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend && bun run build 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWallet.ts
git commit -m "feat(wallet): add gas-sponsored sendSolanaTransaction via Privy"
```

---

### Task 6: Extend Solana trade tx builder for wSOL collateral + auto-wrap

**Files:**
- Modify: `src/lib/bridgeTx.ts`

- [ ] **Step 1: Update `buildSolanaTradeTransaction` to handle wSOL collateral**

The function currently hardcodes USDC as the collateral mint. For calls (sell side), the collateral is wSOL. Also add auto-wrap instructions when the user has native SOL but not enough wSOL.

Add imports at the top:

```typescript
import {
  getAssociatedTokenAddress,
  createApproveInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createSyncNativeInstruction,
} from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { SOLANA_WSOL_MINT } from "@/lib/solana";
```

Remove the existing import of only `getAssociatedTokenAddress`, `createApproveInstruction`, `TOKEN_PROGRAM_ID` from `@solana/spl-token`.

Replace the `buildSolanaTradeTransaction` function:

```typescript
export async function buildSolanaTradeTransaction(
  quote: PriceQuote,
  amount: number,
  isBuy: boolean,
  assetSlug: string,
  ownerPubkey: PublicKey,
  /** Current wSOL balance — used to decide if wrapping is needed */
  wsolBalance?: bigint,
): Promise<Transaction> {
  if (!solanaConnection) {
    throw new Error("Solana RPC not configured");
  }
  if (!SOLANA_USDC_MINT) {
    throw new Error("Solana USDC mint not configured");
  }

  const { oTokenAmount, collateral } =
    computeCollateral(isBuy, amount, quote.strike, assetSlug);

  // Determine collateral mint based on option type
  const collateralMintStr = isBuy ? SOLANA_USDC_MINT : SOLANA_WSOL_MINT;
  const collateralMint = toPublicKey(collateralMintStr, "collateral mint");

  const ownerAta = await getAssociatedTokenAddress(
    collateralMint, ownerPubkey, false, TOKEN_PROGRAM_ID,
  );

  const marginPoolPda = PublicKey.findProgramAddressSync(
    [Buffer.from("margin_pool")],
    SOLANA_PROGRAMS.marginPool,
  )[0];

  const tx = new Transaction();

  // For calls: auto-wrap native SOL → wSOL if needed
  if (!isBuy) {
    const currentWsol = wsolBalance ?? BigInt(0);
    if (currentWsol < collateral) {
      const wrapAmount = collateral - currentWsol;

      // Create wSOL ATA if it doesn't exist
      const ataInfo = await solanaConnection.getAccountInfo(ownerAta);
      if (!ataInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            ownerPubkey,
            ownerAta,
            ownerPubkey,
            collateralMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
        );
      }

      // Transfer native SOL to wSOL ATA
      tx.add(
        SystemProgram.transfer({
          fromPubkey: ownerPubkey,
          toPubkey: ownerAta,
          lamports: wrapAmount,
        }),
      );

      // Sync native balance to update wSOL amount
      tx.add(createSyncNativeInstruction(ownerAta, TOKEN_PROGRAM_ID));
    }
  }

  // Approve collateral to margin pool
  const approveIx = createApproveInstruction(
    ownerAta,
    marginPoolPda,
    ownerPubkey,
    collateral,
    [],
    TOKEN_PROGRAM_ID,
  );
  tx.add(approveIx);

  // executeOrder: Anchor discriminator + Borsh args
  const discriminator = Buffer.from("733db418a820d714", "hex");
  const oTokenMint = toPublicKey(quote.otoken_address!, "oToken mint");

  const ixData = Buffer.concat([
    discriminator,
    oTokenMint.toBuffer(),
    u64Le(BigInt(quote.bid_price_raw!)),
    u64Le(BigInt(quote.deadline!)),
    u64Le(BigInt(quote.quote_id!)),
    u64Le(BigInt(quote.max_amount_raw!)),
    u64Le(BigInt(quote.maker_nonce!)),
    lengthPrefixed(
      Buffer.from(quote.signature!.replace("0x", ""), "hex"),
    ),
    u64Le(oTokenAmount),
    u64Le(collateral),
  ]);

  const executeIx = new TransactionInstruction({
    programId: SOLANA_PROGRAMS.batchSettler,
    keys: [
      { pubkey: ownerPubkey, isSigner: true, isWritable: true },
      { pubkey: oTokenMint, isSigner: false, isWritable: true },
      { pubkey: ownerAta, isSigner: false, isWritable: true },
      { pubkey: marginPoolPda, isSigner: false, isWritable: true },
      { pubkey: SOLANA_PROGRAMS.marginPool, isSigner: false, isWritable: false },
      { pubkey: SOLANA_PROGRAMS.batchSettler, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: new PublicKey("11111111111111111111111111111111"),
        isSigner: false,
        isWritable: false,
      },
    ],
    data: ixData,
  });
  tx.add(executeIx);

  const { blockhash } = await solanaConnection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = ownerPubkey;

  return tx;
}
```

- [ ] **Step 2: Update callers to pass `wsolBalance`**

In `src/hooks/useBridgeAndTrade.ts`, the `executeBaseToSolana` function calls `buildSolanaTradeTransaction`. For bridge-and-trade, wSOL balance isn't relevant (the user is bridging USDC for puts). Pass `undefined` to keep existing behavior.

The new direct Solana trade path in AcceptModal (Task 8) will pass the actual wSOL balance.

- [ ] **Step 3: Verify build**

Run: `cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend && bun run build 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add src/lib/bridgeTx.ts
git commit -m "feat(bridgeTx): support wSOL collateral and auto-wrap for SOL calls"
```

---

### Task 7: Unified balance in ConnectButton

**Files:**
- Modify: `src/components/ConnectButton.tsx`

- [ ] **Step 1: Add Solana balance and show unified total**

```typescript
"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { useSolanaBalance } from "@/hooks/useSolanaBalance";
import { DepositModal } from "@/components/DepositModal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function ConnectButton() {
  const { address, solanaAddress, isConnected, isReady, connectWallet } =
    useWallet();
  const { usd, loading: balancesLoading } = useBalances(address);
  const { solanaUsdc, loading: solLoading } = useSolanaBalance(solanaAddress);
  const [showDeposit, setShowDeposit] = useState(false);

  if (!isReady) {
    return (
      <div className="h-9 w-24 animate-pulse rounded-full bg-[var(--surface)]" />
    );
  }

  if (isConnected) {
    const total = usd + solanaUsdc;
    const loading = balancesLoading || solLoading;
    const hasBalance = total > 0;
    const balanceLabel = hasBalance
      ? `$${total.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "Deposit";

    return (
      <>
        <Popover>
          <PopoverTrigger asChild>
            <button className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--text-secondary)] transition-colors flex items-center gap-1.5">
              {loading ? "..." : balanceLabel}
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[200px] p-3 border-[var(--border)] bg-[var(--bg)]"
            align="end"
          >
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[var(--text)]">
                <span className="flex items-center gap-1.5">
                  <img src="/base.svg" alt="Base" className="w-3.5 h-3.5" />
                  Base
                </span>
                <span className="font-mono">
                  ${usd.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between text-[var(--text)]">
                <span className="flex items-center gap-1.5">
                  <img src="/sol.png" alt="Solana" className="w-3.5 h-3.5 rounded-full" />
                  Solana
                </span>
                <span className="font-mono">
                  ${solanaUsdc.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="h-px bg-[var(--border)]" />
              <button
                onClick={() => setShowDeposit(true)}
                className="w-full text-center text-xs text-[var(--accent)] hover:underline"
              >
                Deposit
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {showDeposit && (
          <DepositModal onClose={() => setShowDeposit(false)} />
        )}
      </>
    );
  }

  return (
    <button
      onClick={connectWallet}
      className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] transition-colors"
    >
      Connect
    </button>
  );
}
```

- [ ] **Step 2: Add SOL icon**

Download or create a SOL logo at `public/sol.png`. A simple 40x40 purple circle with SOL mark. For now, you can copy any Solana logo PNG to that path.

- [ ] **Step 3: Verify build**

Run: `cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend && bun run build 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add src/components/ConnectButton.tsx public/sol.png
git commit -m "feat(ConnectButton): unified USDC balance with per-chain breakdown"
```

---

### Task 8: Positions — add Solana address, chain badge, explorer links

**Files:**
- Modify: `src/hooks/usePositions.ts`
- Modify: `src/components/PositionCard.tsx`
- Modify: `src/app/positions/page.tsx`

- [ ] **Step 1: Add `solanaAddress` parameter to `usePositions`**

In `src/hooks/usePositions.ts`, change the function signature:

```typescript
export function usePositions(
  address: string | undefined,
  fundingAddress: string | undefined,
  solanaAddress?: string | undefined,
  pollInterval = 15_000,
) {
```

In the `refresh` callback, add the Solana address query:

```typescript
const queries: Promise<Position[]>[] = [];
if (address) queries.push(api.getPositions(address));
if (fundingAddress && fundingAddress !== address) {
  queries.push(api.getPositions(fundingAddress));
}
if (solanaAddress) {
  queries.push(api.getPositions(solanaAddress));
}
```

Add `solanaAddress` to the `useCallback` dependency array.

- [ ] **Step 2: Update positions page to pass `solanaAddress`**

In `src/app/positions/page.tsx`, line 108-109:

```typescript
const { address, fundingAddress, solanaAddress, isConnected } = useWallet();
const { positions, loading, refresh } = usePositions(address, fundingAddress, solanaAddress);
```

- [ ] **Step 3: Add chain badge and chain-aware explorer links to PositionCard**

In `src/components/PositionCard.tsx`:

Add import:

```typescript
import { SOLANA_EXPLORER_URL } from "@/lib/solana";
```

Replace the `EXPLORER` constant (line 15):

```typescript
const BASE_EXPLORER = CHAIN.blockExplorers?.default.url ?? null;
```

Add a helper function for chain-aware explorer:

```typescript
function explorerTxUrl(
  txHash: string,
  assetSlug: string,
): string | null {
  if (assetSlug === "sol") {
    return `${SOLANA_EXPLORER_URL}/tx/${txHash}`;
  }
  return BASE_EXPLORER ? `${BASE_EXPLORER}/tx/${txHash}` : null;
}
```

In the JSX, after the header line for active positions (inside the `<div className="flex items-center justify-between">`), add a chain badge:

```typescript
{/* After the position title, before optimistic badge */}
<span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
  assetSlug === "sol"
    ? "bg-purple-500/10 text-purple-400"
    : "bg-blue-500/10 text-blue-400"
}`}>
  {assetSlug === "sol" ? "Solana" : "Base"}
</span>
```

Replace all `EXPLORER` references with `explorerTxUrl`:

```typescript
// Before:
{EXPLORER && position.tx_hash && (
  <a href={`${EXPLORER}/tx/${position.tx_hash}`} ...>Open tx</a>
)}

// After:
{position.tx_hash && (() => {
  const url = explorerTxUrl(position.tx_hash, assetSlug);
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--accent)] hover:underline">
      Open tx
    </a>
  ) : null;
})()}
```

Apply the same pattern for `settlement_tx_hash` and `delivery_tx_hash`.

- [ ] **Step 4: Verify build**

Run: `cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend && bun run build 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePositions.ts src/components/PositionCard.tsx src/app/positions/page.tsx
git commit -m "feat(positions): add Solana address query, chain badges, and chain-aware explorer links"
```

---

### Task 9: Asset selector — show SOL

**Files:**
- Modify: `src/components/v2/AssetSelector.tsx`

- [ ] **Step 1: Add SOL to the logo map**

```typescript
const ASSET_LOGOS: Record<string, string> = {
  eth: "/eth.png",
  btc: "/cbbtc.webp",
  sol: "/sol.png",
};
```

Remove the `aero` and `virtual` entries from this map.

- [ ] **Step 2: Add chain indicator to the dropdown items**

Inside the `CommandItem` render, after the asset name, add a subtle chain label:

```typescript
<span className="text-xs text-[var(--text-secondary)]">
  {asset.name}
</span>
{asset.chain === "solana" && (
  <span className="text-[9px] font-medium text-purple-400 bg-purple-500/10 px-1 py-0.5 rounded ml-auto">
    Solana
  </span>
)}
```

Remove the "Soon" badge rendering since we removed `comingSoon` assets.

- [ ] **Step 3: Verify build**

Run: `cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend && bun run build 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add src/components/v2/AssetSelector.tsx
git commit -m "feat(AssetSelector): add SOL with chain indicator badge"
```

---

### Task 10: Update `checkDeficit` for wSOL calls + `needsDeposit`

**Files:**
- Modify: `src/hooks/useBridgeAndTrade.ts`

- [ ] **Step 1: Add `needsDeposit` to `DeficitResult`**

```typescript
export interface DeficitResult {
  needsBridge: boolean;
  needsDeposit: boolean;
  sourceChain: ChainId | null;
  deficit: bigint;
}
```

- [ ] **Step 2: Update `checkDeficit` to handle SOL calls**

Replace the `checkDeficit` function body:

```typescript
const checkDeficit = useCallback(
  (
    quote: PriceQuote,
    amount: number,
    isBuy: boolean,
    assetSlug: string,
    baseUsdcRaw: bigint,
    solanaUsdcRaw: bigint,
    solanaWsolRaw?: bigint,
    solanaSolRaw?: bigint,
  ): DeficitResult => {
    if (!quote.chain) {
      throw new Error(
        "Quote is missing the `chain` field. " +
          "This is a bug — all quotes must specify their chain.",
      );
    }

    const { collateral } = computeCollateral(
      isBuy, amount, quote.strike, assetSlug,
    );

    // Puts (buy side): USDC collateral — can bridge cross-chain
    if (isBuy) {
      const targetBalance =
        quote.chain === "base" ? baseUsdcRaw : solanaUsdcRaw;

      if (targetBalance >= collateral) {
        return { needsBridge: false, needsDeposit: false, sourceChain: null, deficit: BigInt(0) };
      }

      const deficit = collateral - targetBalance;
      const sourceChain: ChainId =
        quote.chain === "base" ? "solana" : "base";

      return { needsBridge: true, needsDeposit: false, sourceChain, deficit };
    }

    // Calls (sell side): wrapped asset collateral
    if (quote.chain === "solana") {
      // SOL calls: wSOL + native SOL (auto-wrap handles conversion)
      const available = (solanaWsolRaw ?? BigInt(0)) + (solanaSolRaw ?? BigInt(0));
      if (available >= collateral) {
        return { needsBridge: false, needsDeposit: false, sourceChain: null, deficit: BigInt(0) };
      }
      // Can't bridge SOL/wSOL via CCTP — user must deposit
      return { needsBridge: false, needsDeposit: true, sourceChain: null, deficit: collateral - available };
    }

    // Base calls: existing WETH/cbBTC logic — no bridge check,
    // handled by AcceptModal's on-chain balance check
    return { needsBridge: false, needsDeposit: false, sourceChain: null, deficit: BigInt(0) };
  },
  [],
);
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend && bun run build 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useBridgeAndTrade.ts
git commit -m "feat(bridge): update checkDeficit for wSOL calls with needsDeposit flag"
```

---

### Task 11: AcceptModal — direct Solana execution + SOL balance display

**Files:**
- Modify: `src/components/AcceptModal.tsx`

This is the largest change. The AcceptModal needs three updates:
1. Show wSOL + SOL balance for SOL calls
2. Direct Solana execution path (for non-bridge trades)
3. SOL deposit CTA when wSOL is insufficient
4. Chain-aware explorer links

- [ ] **Step 1: Add imports and Solana balance**

Add to imports:

```typescript
import { useSolanaBalance } from "@/hooks/useSolanaBalance";
import { buildSolanaTradeTransaction } from "@/lib/bridgeTx";
import { SOLANA_EXPLORER_URL, toPublicKey } from "@/lib/solana";
import { pollUntil } from "@/lib/execution";
```

In the component, destructure the new wallet method and balance fields:

```typescript
const { address, solanaAddress, sendBatchTx, sendSolanaTransaction, isConnected, connectWallet } = useWallet();
const { usd, eth, weth, wbtc, usdRaw: baseUsdcRaw } = useBalances(address);
const { solanaUsdcRaw, solanaWsolRaw, solanaSolRaw, solanaWsol, solanaSol } = useSolanaBalance(solanaAddress);
```

- [ ] **Step 2: Update `walletBalance` for SOL calls**

Replace the existing `walletBalance` calculation:

```typescript
const isSol = assetSlug === "sol";
const walletBalance = isBuy
  ? usd
  : isSol
    ? solanaWsol + solanaSol
    : isBtc ? wbtc : eth + weth;
```

- [ ] **Step 3: Update `checkDeficit` call to pass wSOL balance**

Replace the existing `checkDeficit` call inside `handleAccept`:

```typescript
const deficit = checkDeficit(
  quote, amount, isBuy, assetSlug,
  baseUsdcRaw, solanaUsdcRaw,
  solanaWsolRaw, solanaSolRaw,
);
```

- [ ] **Step 4: Add `needsDeposit` handling after bridge check**

After the existing bridge-and-trade block (after `return;` on line 195), add:

```typescript
// SOL calls: insufficient wSOL + SOL, can't bridge
if (deficit.needsDeposit) {
  setDepositToken("usdc"); // Will be overridden by deposit CTA
  setError(
    "Insufficient SOL for covered call. Deposit SOL to your Solana wallet.",
  );
  return;
}
```

- [ ] **Step 5: Add direct Solana execution path**

After the bridge/deposit checks, before the existing EVM execution path (before `computeCollateral` call on the current line 198), add a new branch:

```typescript
// Direct Solana execution (no bridge needed)
if (quote.chain === "solana" && !deficit.needsBridge) {
  if (!solanaAddress) {
    setError("Solana wallet not ready. Please wait and try again.");
    return;
  }

  updateStep("executing");

  const solanaPk = toPublicKey(solanaAddress, "Solana wallet");
  const tradeTx = await buildSolanaTradeTransaction(
    quote, amount, isBuy, assetSlug, solanaPk,
    isBuy ? undefined : solanaWsolRaw,
  );

  const signature = await sendSolanaTransaction(tradeTx);
  setTxHash(signature);
  setChainExecuted("solana");
  updateStep("confirmed");
  onAccepted({ amount, txHash: signature });
  window.dispatchEvent(new Event("balance:refetch"));

  // Cast: optimistic position `user_address` is stored as string internally.
  // Solana base58 address doesn't match viem `Address` type but works at runtime.
  const pos = buildOptimisticPosition(
    quote, amount, isBuy, solanaAddress as unknown as Address, assetSlug,
  );
  try { saveOptimistic(pos); } catch (err) {
    console.warn("[AcceptModal] Could not save optimistic position:", err);
  }
  return;
}
```

This must go BEFORE the existing EVM path so that Solana quotes don't fall through to EVM execution.

- [ ] **Step 6: Fix explorer link for Solana trades**

Replace the existing explorer link block at the bottom of the component (around line 465):

```typescript
{step === "confirmed" && txHash && (
  <a
    href={
      chainExecuted === "solana"
        ? `${SOLANA_EXPLORER_URL}/tx/${txHash}`
        : `${CHAIN.blockExplorers?.default.url}/tx/${txHash}`
    }
    target="_blank"
    rel="noopener noreferrer"
    className="block text-center text-sm text-[var(--accent)] hover:underline"
  >
    View transaction ↗
  </a>
)}
```

- [ ] **Step 7: Update collateral icon for SOL sells**

In the amount input section, the icon currently shows ETH or USDC. Update for SOL:

```typescript
<img
  src={isBuy ? "/usdc.svg" : isSol ? "/sol.png" : `/${assetSlug === "btc" ? "cbbtc.webp" : "eth.png"}`}
  alt={isBuy ? "USDC" : assetSymbol}
  className="w-5 h-5 rounded-full"
/>
```

- [ ] **Step 8: Verify build**

Run: `cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend && bun run build 2>&1 | head -30`

- [ ] **Step 9: Commit**

```bash
git add src/components/AcceptModal.tsx
git commit -m "feat(AcceptModal): direct Solana execution, wSOL balance, chain-aware explorer links"
```

---

### Task 12: Positions page — pass `solSpot` for SOL positions

**Files:**
- Modify: `src/app/positions/page.tsx`

- [ ] **Step 1: Add SOL spot price and pass it to SOL position cards**

Add after the existing spot hooks:

```typescript
const { spot: solSpot } = useSpot("sol");
```

In the position card rendering (around line 229), update the spot resolution:

```typescript
const posSpot = posAsset.slug === "btc"
  ? btcSpot
  : posAsset.slug === "sol"
    ? solSpot
    : ethSpot;
```

Apply the same pattern in the history section and for RangePositionCard.

- [ ] **Step 2: Update PortfolioSummary call to include SOL spot**

The `PortfolioSummary` component currently receives `ethSpot` and `btcSpot`. Add `solSpot`:

```typescript
<PortfolioSummary
  positions={allPositions}
  activity={activity}
  yieldMetric={yieldMetric}
  onYieldMetricChange={setYieldMetric}
  yieldAssets={yieldSummary?.assets}
  yieldPositionTotals={yieldPositions?.totals}
  ethSpot={ethSpot}
  btcSpot={btcSpot}
  solSpot={solSpot}
/>
```

Update `PortfolioSummary`'s props to accept and use `solSpot` for SOL position value calculations (the `committedUsd` calculation for SOL calls uses `collateral / 1e9 * solSpot`).

- [ ] **Step 3: Update collateral decimals in PositionCard for SOL**

In `src/components/PositionCard.tsx`, the call decimal is currently:

```typescript
const isBtc = assetSlug === "btc";
const callDec = isBtc ? 1e8 : 1e18;
```

Replace with:

```typescript
import { getAssetConfig } from "@/lib/assets";

const config = getAssetConfig(assetSlug);
const callDec = 10 ** (config?.collateralDecimals ?? 18);
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend && bun run build 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add src/app/positions/page.tsx src/components/PositionCard.tsx src/components/PortfolioSummary.tsx
git commit -m "feat(positions): SOL spot price, generalized collateral decimals in PositionCard"
```

---

### Task 13: Final integration — verify full flow

- [ ] **Step 1: Verify `tsc --noEmit` passes**

Run: `cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend && bunx tsc --noEmit 2>&1 | head -40`

Fix any type errors.

- [ ] **Step 2: Verify build succeeds**

Run: `cd /Users/rafa/Desktop/SoftwareDevelopment/personal/options/frontend && bun run build 2>&1 | tail -20`

- [ ] **Step 3: Manual smoke test checklist**

With `bun dev` running:

1. Navigate to `/earn` — verify asset selector shows ETH, cbBTC, SOL
2. Click SOL — navigates to `/earn/sol`, price menu loads (or shows empty if backend not running)
3. ConnectButton shows unified balance with breakdown popover
4. Navigate to `/positions` — verify both Base and Solana positions load
5. SOL positions show purple "Solana" chain badge
6. SOL position "Open tx" links go to Solscan

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address integration issues from smoke test"
```
