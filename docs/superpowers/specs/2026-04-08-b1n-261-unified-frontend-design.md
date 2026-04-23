# B1N-261: Unified Balance, Positions, and Trade Routing

## Problem

User has two wallets (Base smart wallet + Solana embedded wallet) but should see a single unified experience. Balance, positions, and trade routing should work transparently across both chains.

## Scope

- SOL markets only (no XAU, no JUP for now)
- Both puts (USDC collateral) and calls (wSOL collateral)
- Automatic bridging when target chain has insufficient USDC
- Automatic wSOL wrapping for covered calls (like ETH→WETH on Base)

## Reference

- Global plan: `playbook/docs/superpowers/specs/2026-04-06-solana-cross-chain-integration.md`
- Blocking tickets (completed): B1N-259 (Privy Solana wallet), B1N-260 (CCTP bridge)

---

## 1. Asset Registry

**File:** `src/lib/assets.ts`

Add `chain` field to `AssetConfig`:

```typescript
interface AssetConfig {
  // ... existing fields ...
  chain: "base" | "solana";
  /** Collateral decimals for the wrapped asset (calls) */
  collateralDecimals: number;
}
```

Add SOL config:

```typescript
sol: {
  slug: "sol",
  symbol: "SOL",
  name: "Solana",
  wrappedSymbol: "wSOL",
  stableSymbol: "USDC",
  chain: "solana",
  collateralDecimals: 9,
  maxAmount: 10_000,
  maxAmountUsd: 1_000_000,
  amountPlaceholder: "10",
  displayDecimals: 4,
  minSellAmount: 0.1,
  minBuyAmountUsd: 10,
}
```

Existing assets get `chain: "base"` and appropriate `collateralDecimals` (ETH: 18, BTC: 8).

Remove `aero` and `virtual` (dead entries with `comingSoon: true`, nothing uses them).

Update `resolvePositionAsset` to handle SOL positions (backend will return `asset: "sol"`).

---

## 2. Solana Addresses & Config

**File:** `src/lib/solana.ts` (extend)

Add wSOL mint and Solana program addresses:

```typescript
// Native SOL mint (used as wSOL SPL token)
export const SOLANA_WSOL_MINT = "So11111111111111111111111111111111111111112";

// Solscan base URL for tx links
export const SOLANA_EXPLORER_URL =
  process.env.NEXT_PUBLIC_SOLANA_EXPLORER_URL ?? "https://solscan.io";
```

**File:** `src/lib/bridgeTx.ts` — `SOLANA_PROGRAMS` already has `batchSettler` and `marginPool`. No changes needed here.

---

## 3. Collateral Computation

**File:** `src/lib/execution.ts` — `computeCollateral`

Currently handles ETH (18-dec WETH) and BTC (8-dec cbBTC) for calls with hardcoded branches. With `collateralDecimals` on `AssetConfig`, generalize to a single formula:

```
Sell side (calls):
  collateral = oTokenAmount * 10^(collateralDecimals - 8)

  ETH (18):  oTokenAmount * 10^10  ✓
  BTC (8):   oTokenAmount * 1      ✓
  SOL (9):   oTokenAmount * 10     ✓
```

Replace the `isBtc` branch with `BigInt(10) ** BigInt(config.collateralDecimals - 8)`.

For `collateralAsset`: only used in the EVM execution path (AcceptModal's balance check + approve). The Solana execution path resolves its own mint addresses. For SOL, `collateralAsset` is unused because the Solana branch returns before reaching EVM balance checks.

The buy side (puts, USDC collateral) is unchanged — same formula, same 6 decimals on both chains.

---

## 4. Trade Routing

**File:** `src/components/AcceptModal.tsx`

The current flow has a gap: when `quote.chain === "solana"` and the user has sufficient balance, it falls through to the EVM execution path. New routing:

```
handleAccept():
  |
  quote.chain === "solana"?
  |        |
  no       yes
  |        |
  v        v
  EVM      isBuy (put)?
  path       |        |
  (no        yes      no (call)
  change)    |        |
             v        v
           Check      Check wSOL balance
           Solana     on Solana (+ native SOL
           USDC      for auto-wrap)
             |              |
             v              v
           enough?       wSOL + SOL >= needed?
           |    |          |         |
           yes  no         yes       no
           |    |          |         |
           v    v          v         v
         Direct Bridge   Direct    Deposit
         Solana from     Solana    flow
         trade  Base     trade    (wSOL/SOL)
                         (with wrap)
```

### Direct Solana trade (new path)

Same pattern as Base: **frontend builds tx, signs, and sends directly**. Privy's `useSignAndSendTransaction` hook with `sponsor: true` covers gas fees — user never needs SOL.

```typescript
import { useSignAndSendTransaction } from '@privy-io/react-auth/solana';

const { signAndSendTransaction } = useSignAndSendTransaction();

const result = await signAndSendTransaction({
  transaction: serializedTx,
  wallet: solanaEmbeddedWallet,
  options: { sponsor: true },
});
```

Implementation:

1. Build Solana trade tx via `buildSolanaTradeTransaction` (extended for wSOL)
2. Sign and send via Privy `signAndSendTransaction` with `sponsor: true`
3. Poll for on-chain confirmation (balance change, same as Base `fireAndPoll`)

No backend involvement for direct trades. The bridge-and-trade endpoint is only used when CCTP bridging is needed.

**Privy dashboard prerequisite:** Enable Solana gas sponsorship in the Privy dashboard settings. This is a one-time configuration.

### wSOL auto-wrapping

For SOL covered calls, include wrap instructions in the trade transaction:

1. Create wSOL ATA if it doesn't exist (`createAssociatedTokenAccountInstruction`)
2. Transfer native SOL → wSOL ATA (`SystemProgram.transfer`)
3. Sync native balance (`syncNative` instruction)
4. Approve wSOL to margin pool PDA
5. `executeOrder`

All five instructions go in one transaction. The signing + submission flow is the same as any Solana trade.

---

## 5. Solana Trade Transaction Building

**File:** `src/lib/bridgeTx.ts` — `buildSolanaTradeTransaction`

Currently hardcodes USDC as collateral mint. Extend to accept the correct collateral mint based on option type:

**For puts (buy):** collateral = USDC → use `SOLANA_USDC_MINT` (unchanged)
**For calls (sell):** collateral = wSOL → use `SOLANA_WSOL_MINT`

Changes:
- Determine collateral mint from `isBuy` flag
- For calls: prepend wrap instructions if `wSOL balance < collateral`
- Change the approve instruction to delegate the correct ATA (USDC or wSOL)
- Update `executeOrder` instruction accounts to include correct collateral token account

---

## 6. Balance Display

### 6a. Solana balance hook

**File:** `src/hooks/useSolanaBalance.ts`

Extend to also fetch wSOL balance and native SOL balance:

```typescript
interface SolanaBalance {
  solanaUsdcRaw: bigint;
  solanaUsdc: number;
  solanaWsolRaw: bigint;       // wSOL SPL token balance
  solanaWsol: number;
  solanaSolRaw: bigint;        // native SOL balance (lamports)
  solanaSol: number;
  loading: boolean;
  error: string | null;
}
```

Fetch in parallel:
- USDC: `getParsedTokenAccountsByOwner(owner, { mint: USDC_MINT })`
- wSOL: `getParsedTokenAccountsByOwner(owner, { mint: WSOL_MINT })`
- SOL: `connection.getBalance(owner)`

### 6b. Unified balance in ConnectButton

**File:** `src/components/ConnectButton.tsx`

Display `baseUsdc + solanaUsdc` as the total USDC balance. On click/hover, show breakdown:

```
Total: $500.00 USDC
├ Base:   $300.00
└ Solana: $200.00
```

### 6c. AcceptModal balance display

For SOL sells (calls), show combined wSOL + native SOL as available balance:

```typescript
const walletBalance = isBuy
  ? usd  // USDC for puts (unchanged)
  : assetSlug === "sol"
    ? solanaWsol + solanaSol  // wSOL + SOL for SOL calls
    : isBtc ? wbtc : eth + weth;  // existing logic
```

---

## 7. Positions

### 7a. Fetch positions for Solana address

**File:** `src/hooks/usePositions.ts`

Add `solanaAddress` as a third address to query:

```typescript
export function usePositions(
  address: string | undefined,      // smart wallet
  fundingAddress: string | undefined, // EOA
  solanaAddress: string | undefined,  // Solana embedded
  pollInterval = 15_000,
)
```

Merge + deduplicate by `id` (same as existing logic for dual EVM addresses).

### 7b. Chain indicator on PositionCard

**File:** `src/components/PositionCard.tsx`

Show a chain badge:
- Positions with `asset: "sol"` → "Solana" badge
- Positions with `asset: "eth"` or `asset: "btc"` → "Base" badge
- Fallback to existing `resolvePositionAsset` heuristic

### 7c. Block explorer links

Solana positions link to Solscan (or configured explorer):

```typescript
const explorerUrl = position.asset === "sol"
  ? `${SOLANA_EXPLORER_URL}/tx/${position.tx_hash}`
  : `${CHAIN.blockExplorers.default.url}/tx/${position.tx_hash}`;
```

### 7d. PortfolioSummary

Aggregate stats (premiumEarned, activeCapital, avgApr) across all positions regardless of chain. No change to calculation logic — just ensure the merged position list is passed in.

---

## 8. Price Menu

**File:** `src/components/v2/PriceMenuV2.tsx` (and related)

SOL quotes come from `/prices?asset=sol` with `chain: "solana"`. The price menu already fetches per-asset. Changes:

- `AssetSelector` shows SOL alongside ETH/BTC
- Route: `/earn/sol` → `PriceMenuV2` with `asset={solConfig}`
- SOL asset icon: add `/public/sol.png`
- Subtle chain indicator on the price menu header (e.g., small "on Solana" text or chain icon)

---

## 9. AcceptModal Confirmation

After trade execution:

- Show "Executed on Solana" or "Executed on Base" tag (already partially implemented via `chainExecuted` state)
- For Solana txs: link to Solscan instead of Basescan
- Fix the current explorer link which always uses `CHAIN.blockExplorers` (Base-only)

---

## 10. Bridge Deficit Check

**File:** `src/hooks/useBridgeAndTrade.ts` — `checkDeficit`

Currently only checks USDC balance. For SOL calls, the collateral is wSOL, not USDC. Bridge can't help with wSOL (CCTP only bridges USDC).

Updated logic:

```
checkDeficit(quote, amount, isBuy, assetSlug, balances):
  if isBuy (puts):
    collateral is USDC
    check target chain USDC balance
    if insufficient → bridge from other chain
  if !isBuy (calls):
    if chain === "solana":
      collateral is wSOL
      check Solana wSOL + native SOL
      if insufficient → no bridge possible, return needsDeposit: true
    else:
      existing WETH/cbBTC logic (Base)
```

Add `needsDeposit` to `DeficitResult` for cases where bridging can't help (call collateral on wrong chain).

### Deposit CTA for SOL calls

When `needsDeposit: true` (wSOL + SOL insufficient for a covered call), show a deposit prompt:

- Message: "Deposit SOL to trade covered calls"
- Show the user's Solana embedded wallet address with a copy button
- Link to DepositModal (Solana tab) if an external Solana wallet is connected
- No auto-bridge — CCTP only handles USDC, not SOL/wSOL

---

## 11. Files Changed (Summary)

| File | Change |
|------|--------|
| `src/lib/assets.ts` | Add `chain`, `collateralDecimals` to AssetConfig. Add SOL. Remove aero/virtual. |
| `src/lib/solana.ts` | Add `SOLANA_WSOL_MINT`, `SOLANA_EXPLORER_URL` |
| `src/lib/execution.ts` | Extend `computeCollateral` for SOL (9-dec wSOL) |
| `src/lib/bridgeTx.ts` | Extend `buildSolanaTradeTransaction` for wSOL collateral + auto-wrap |
| `src/hooks/useSolanaBalance.ts` | Add wSOL + native SOL balance tracking |
| `src/hooks/usePositions.ts` | Accept + query `solanaAddress` |
| `src/hooks/useBridgeAndTrade.ts` | Update `checkDeficit` for wSOL collateral; add `needsDeposit` |
| `src/hooks/useWallet.ts` | Add `sendSolanaTransaction` (Privy sponsor: true) |
| `src/components/AcceptModal.tsx` | Add direct Solana execution branch; wSOL balance for calls; Solscan links; SOL deposit CTA |
| `src/components/ConnectButton.tsx` | Unified USDC balance with breakdown |
| `src/components/PositionCard.tsx` | Chain indicator badge; Solscan links |
| `src/components/v2/AssetSelector.tsx` | Show SOL option |
| `src/components/v2/PriceMenuV2.tsx` | Chain indicator on header |
| `src/components/PortfolioSummary.tsx` | Aggregate across chains (minimal change) |
| `public/sol.png` | SOL asset icon |

---

## 12. Backend Assumptions

The following backend capabilities are assumed (from completed blocking tickets):

1. `GET /prices?asset=sol` returns quotes with `chain: "solana"` (B1N-257)
2. `GET /positions/{solanaAddress}` returns Solana positions (B1N-258)
3. Positions include `asset: "sol"` field for SOL markets

No backend changes needed for direct Solana trades — frontend handles signing and sending via Privy with gas sponsorship.

---

## 13. Wallet Hook Changes

**File:** `src/hooks/useWallet.ts`

Add `sendSolanaTransaction` method that wraps Privy's `useSignAndSendTransaction` with `sponsor: true`:

```typescript
const sendSolanaTransaction = useCallback(
  async (tx: Transaction): Promise<string> => {
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

This is the Solana equivalent of `sendBatchTx` for Base. Used by AcceptModal for direct Solana trades.

---

## 14. What Is NOT In Scope

- XAU or JUP markets
- Cross-chain withdrawal (withdraw from chain where funds are)
- Backend changes (separate tickets)
- Solana mainnet RPC configuration (env var swap)
- Rebalancing between chains
