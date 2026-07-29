import {
  decodeEventLog,
  isAddress,
  type Address,
  type TransactionReceipt,
} from "viem";
import type {
  FundPositionResponse,
  FundSummaryResponse,
} from "@/lib/api";
import { FUND_VAULT_ABI } from "@/lib/fundVault";

export const FUND_DEPOSIT_FAST_POLL_MS = 2_500;
export const FUND_DEPOSIT_FAST_POLL_WINDOW_MS = 60_000;
const BASE_SEPOLIA_BLOCKSCOUT_URL = "https://base-sepolia.blockscout.com";

export type OptimisticFundDeposit = {
  transactionHash: `0x${string}`;
  fundKey: string;
  fundAddress: Address;
  smartWallet: Address;
  sender: Address;
  assets: string;
  shares: string;
  blockNumber: string;
  positionSharesBefore: string;
  confirmedAt: number;
};

export type FundVaultSnapshot = {
  summary: FundSummaryResponse;
  position: FundPositionResponse | null;
};

export function fundDepositTransactionUrl(
  transactionHash: string,
): string {
  return `${BASE_SEPOLIA_BLOCKSCOUT_URL}/tx/${transactionHash}`;
}

type DepositReceipt = Pick<
  TransactionReceipt,
  "status" | "blockNumber" | "logs"
>;

export function confirmedFundDepositFromReceipt({
  receipt,
  transactionHash,
  fundKey,
  fundAddress,
  smartWallet,
  positionSharesBefore,
  confirmedAt = Date.now(),
}: {
  receipt: DepositReceipt;
  transactionHash: `0x${string}`;
  fundKey: string;
  fundAddress: Address;
  smartWallet: Address;
  positionSharesBefore: bigint;
  confirmedAt?: number;
}): OptimisticFundDeposit {
  if (receipt.status !== "success") {
    throw new Error("Fund transaction reverted.");
  }

  for (const log of receipt.logs) {
    if (!sameAddress(log.address, fundAddress)) continue;
    try {
      const decoded = decodeEventLog({
        abi: FUND_VAULT_ABI,
        eventName: "Deposit",
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Deposit") continue;
      const { sender, owner, assets, shares } = decoded.args;
      if (!sameAddress(owner, smartWallet)) continue;
      return {
        transactionHash,
        fundKey,
        fundAddress,
        smartWallet,
        sender,
        assets: assets.toString(),
        shares: shares.toString(),
        blockNumber: receipt.blockNumber.toString(),
        positionSharesBefore: positionSharesBefore.toString(),
        confirmedAt,
      };
    } catch {
      // A receipt can include approval and unrelated logs. Only the trusted
      // fund's exact ERC-4626 Deposit event is accepted.
    }
  }

  throw new Error(
    "Confirmed transaction did not include a trusted deposit for this smart wallet.",
  );
}

export function fundDepositStorageKey(
  fundKey: string,
  smartWallet: Address,
): string {
  return `b1nary:fund-deposits:${fundKey.toLowerCase()}:${smartWallet.toLowerCase()}`;
}

export function loadOptimisticFundDeposits(
  fundKey: string,
  smartWallet: Address,
): OptimisticFundDeposit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(
      fundDepositStorageKey(fundKey, smartWallet),
    );
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is OptimisticFundDeposit =>
        isOptimisticFundDeposit(item) &&
        item.fundKey === fundKey &&
        sameAddress(item.smartWallet, smartWallet),
    );
  } catch {
    return [];
  }
}

export function persistOptimisticFundDeposits(
  fundKey: string,
  smartWallet: Address,
  deposits: readonly OptimisticFundDeposit[],
): void {
  if (typeof window === "undefined") return;
  const key = fundDepositStorageKey(fundKey, smartWallet);
  try {
    if (deposits.length === 0) {
      window.sessionStorage.removeItem(key);
      return;
    }
    window.sessionStorage.setItem(key, JSON.stringify(deposits));
  } catch {
    // sessionStorage is a recovery aid. The live in-memory overlay remains
    // authoritative for this tab when storage is unavailable.
  }
}

export function upsertOptimisticFundDeposit(
  deposits: readonly OptimisticFundDeposit[],
  deposit: OptimisticFundDeposit,
): OptimisticFundDeposit[] {
  const hash = deposit.transactionHash.toLowerCase();
  return [
    ...deposits.filter(
      (item) => item.transactionHash.toLowerCase() !== hash,
    ),
    deposit,
  ].sort((left, right) => left.confirmedAt - right.confirmedAt);
}

export function fundDepositIsIndexed(
  snapshot: FundVaultSnapshot,
  deposit: OptimisticFundDeposit,
): boolean {
  if (!snapshot.position) return false;
  const receiptBlock = BigInt(deposit.blockNumber);
  const summaryBlock = snapshot.summary.asOfBlock;
  const positionBlock = snapshot.position.asOfBlock;
  if (
    summaryBlock == null ||
    positionBlock == null ||
    BigInt(summaryBlock) < receiptBlock ||
    BigInt(positionBlock) < receiptBlock
  ) {
    return false;
  }
  const requiredShares =
    BigInt(deposit.positionSharesBefore) + BigInt(deposit.shares);
  return BigInt(snapshot.position.shares) >= requiredShares;
}

export function unresolvedFundDeposits(
  snapshot: FundVaultSnapshot,
  deposits: readonly OptimisticFundDeposit[],
): OptimisticFundDeposit[] {
  return deposits.filter(
    (deposit) => !fundDepositIsIndexed(snapshot, deposit),
  );
}

export function applyOptimisticFundDeposits(
  summary: FundSummaryResponse | null,
  position: FundPositionResponse | null,
  deposits: readonly OptimisticFundDeposit[],
  smartWallet: Address | undefined,
): FundVaultSnapshot | null {
  if (!summary) return null;
  const applicable = deposits.filter(
    (deposit) =>
      smartWallet &&
      deposit.fundKey === summary.fund.fundKey &&
      sameAddress(deposit.fundAddress, summary.fund.fundAddress) &&
      sameAddress(deposit.smartWallet, smartWallet) &&
      !fundDepositIsIndexed({ summary, position }, deposit),
  );
  if (applicable.length === 0) return { summary, position };

  const totalAssets = applicable.reduce(
    (sum, deposit) => sum + BigInt(deposit.assets),
    BigInt(0),
  );
  const totalShares = applicable.reduce(
    (sum, deposit) => sum + BigInt(deposit.shares),
    BigInt(0),
  );
  const netAssets = BigInt(summary.netAssets) + totalAssets;
  const shareSupply = BigInt(summary.shareSupply) + totalShares;
  const virtualShares = BigInt(summary.virtualShares);
  const denominator = shareSupply + virtualShares;
  const shareUnit = BigInt(10) ** BigInt(summary.fund.shareToken.decimals);
  const sharePriceAssets =
    denominator > BigInt(0)
      ? ((netAssets + BigInt(1)) * shareUnit) / denominator
      : BigInt(summary.sharePriceAssets);

  const displaySummary: FundSummaryResponse = {
    ...summary,
    netAssets: netAssets.toString(),
    shareSupply: shareSupply.toString(),
    sharePriceAssets: sharePriceAssets.toString(),
    composition: {
      ...summary.composition,
      idleAssets: (
        BigInt(summary.composition.idleAssets) + totalAssets
      ).toString(),
      grossAssets:
        summary.composition.grossAssets == null
          ? summary.composition.grossAssets
          : (
              BigInt(summary.composition.grossAssets) + totalAssets
            ).toString(),
    },
  };

  const displayPosition =
    position ??
    emptyFundPosition(
      summary.fund.fundKey,
      smartWallet!,
      summary.actions,
      summary.asOfBlock,
      summary.indexedAt,
    );
  const positionShares = BigInt(displayPosition.shares) + totalShares;
  const accountingValue =
    denominator > BigInt(0)
      ? (positionShares * (netAssets + BigInt(1))) / denominator
      : BigInt(0);

  return {
    summary: displaySummary,
    position: {
      ...displayPosition,
      shares: positionShares.toString(),
      accountingValue: accountingValue.toString(),
    },
  };
}

function emptyFundPosition(
  fundKey: string,
  smartWallet: Address,
  actions: FundSummaryResponse["actions"],
  asOfBlock: number | null,
  indexedAt: string | null,
): FundPositionResponse {
  return {
    fundKey,
    address: smartWallet,
    shares: "0",
    accountingValue: "0",
    redemption: {
      pendingShares: "0",
      claimableShares: "0",
      claimableAssets: "0",
      status: "idle",
      nextAction: "none",
      latestBatchId: 0,
      latestBatchProcessing: false,
      latestBatchUnwindCommitted: false,
    },
    actions,
    asOfBlock,
    indexedAt,
    stale: false,
  };
}

function isOptimisticFundDeposit(
  value: unknown,
): value is OptimisticFundDeposit {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<OptimisticFundDeposit>;
  return Boolean(
    typeof item.transactionHash === "string" &&
      /^0x[0-9a-fA-F]{64}$/.test(item.transactionHash) &&
      typeof item.fundKey === "string" &&
      typeof item.fundAddress === "string" &&
      isAddress(item.fundAddress) &&
      typeof item.smartWallet === "string" &&
      isAddress(item.smartWallet) &&
      typeof item.sender === "string" &&
      isAddress(item.sender) &&
      isUnsignedInteger(item.assets) &&
      isUnsignedInteger(item.shares) &&
      isUnsignedInteger(item.blockNumber) &&
      isUnsignedInteger(item.positionSharesBefore) &&
      typeof item.confirmedAt === "number" &&
      Number.isFinite(item.confirmedAt),
  );
}

function isUnsignedInteger(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

function sameAddress(
  left: string | undefined,
  right: string | undefined,
): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}
