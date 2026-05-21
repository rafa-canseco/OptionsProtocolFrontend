"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowRight, Bot, CalendarDays, Check, CircleDollarSign, History, Loader2, ShieldCheck, Target, Wallet } from "lucide-react";
import { keccak256, type Address } from "viem";
import { useB1naryAccount } from "@/hooks/useB1naryAccount";
import { useBalances } from "@/hooks/useBalances";
import { useSolanaBalance } from "@/hooks/useSolanaBalance";
import { useWallet, type BatchCall } from "@/hooks/useWallet";
import {
  agoraStatusLabel,
  createAgoraDepositIntent,
  getAgoraCapitalIntent,
  getAgoraSnapshot,
  prepareAgoraAllocation,
  type AgoraCapitalIntent,
  type AgoraHistoryItem,
  type AgoraPreparedAllocation,
  type AgoraSnapshot,
  type AgoraSourceChain,
} from "@/lib/agora";
import { api, type PriceQuote } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

type View = "deposit" | "vault" | "history" | "agent";

interface SourceBalance {
  chain: AgoraSourceChain;
  label: string;
  wallet: string | null;
  walletType: string;
  balance: number;
  balanceRaw: bigint;
  enabled: boolean;
  note: string;
}

type AllocationProgressStatus =
  | "idle"
  | "preparing"
  | "executing"
  | "registering"
  | "attesting"
  | "minting"
  | "finalizing"
  | "submitted"
  | "complete"
  | "blocked"
  | "error";

interface AllocationProgress {
  status: AllocationProgressStatus;
  title: string;
  message: string;
  txHash?: string;
  intentId?: string;
  lifecycleStatus?: "smart_wallet_approval_burn" | "attesting" | "minting_on_arc" | "finalize_bridge_deposit";
}

const VIEWS: Array<{ id: View; label: string }> = [
  { id: "deposit", label: "Deposit" },
  { id: "vault", label: "My Vault" },
  { id: "history", label: "History" },
  { id: "agent", label: "Agent" },
];

function fmtUsd(value: number): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtPremiumUsd(value: number): string {
  if (value > 0 && value < 0.01) {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6,
    })}`;
  }
  return fmtUsd(value);
}

function fmtAmount(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function nextDeploymentDate(now: Date): Date {
  const next = new Date(now);
  next.setUTCHours(8, 0, 0, 0);
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function formatTimeUntil(target: Date, now: Date): string {
  const ms = Math.max(0, target.getTime() - now.getTime());
  const totalMinutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function truncate(value: string | null | undefined): string {
  if (!value) return "Not available";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function statusTone(status: string): string {
  if (status === "failed") return "text-red-300 border-red-500/30 bg-red-500/10";
  if (status === "retryable") return "text-amber-200 border-amber-400/30 bg-amber-400/10";
  if (status === "claimable" || status === "deployed" || status === "assigned") {
    return "text-emerald-200 border-emerald-400/30 bg-emerald-400/10";
  }
  return "text-[var(--accent)] border-[var(--accent)]/30 bg-[var(--accent)]/10";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildOnchainIntentId({
  allocationId,
  txHash,
  sourceWallet,
  amountRaw,
}: {
  allocationId: string;
  txHash: string;
  sourceWallet: string;
  amountRaw: string;
}): `0x${string}` {
  return keccak256(
    new TextEncoder().encode(`${allocationId}:${txHash}:${sourceWallet}:${amountRaw}`),
  );
}

function progressFromCapitalIntent(
  intent: AgoraCapitalIntent,
  txHash: string,
): AllocationProgress {
  if (intent.status === "failed" || intent.status === "retryable") {
    return {
      status: "error",
      title: intent.status === "retryable" ? "Relayer retry needed" : "Allocation failed",
      message: intent.failure_reason ?? "The relayer could not complete this allocation.",
      txHash,
      intentId: intent.id,
      lifecycleStatus: "attesting",
    };
  }

  if (intent.status === "waiting_to_be_deployed" || intent.status === "deployed" || intent.status === "completed") {
    return {
      status: "complete",
      title: "Deposit finalized",
      message: "USDC is credited in the Arc MetaVault.",
      txHash,
      intentId: intent.id,
      lifecycleStatus: "finalize_bridge_deposit",
    };
  }

  if (intent.arc_finalize_tx_hash) {
    return {
      status: "finalizing",
      title: "Finalizing MetaVault deposit",
      message: "Arc received USDC. The vault is crediting shares for the receiver.",
      txHash,
      intentId: intent.id,
      lifecycleStatus: "finalize_bridge_deposit",
    };
  }

  if (intent.destination_tx || intent.arc_receive_tx_hash) {
    return {
      status: "minting",
      title: "Minting on Arc",
      message: "Circle attestation completed. The relayer is minting USDC on Arc.",
      txHash,
      intentId: intent.id,
      lifecycleStatus: "minting_on_arc",
    };
  }

  return {
    status: "attesting",
    title: "Attesting with Circle",
    message: "The burn was registered. The relayer is waiting for Circle attestation.",
    txHash,
    intentId: intent.id,
    lifecycleStatus: "attesting",
  };
}

function snapshotHasUserData(snapshot: AgoraSnapshot) {
  return Boolean(
    snapshot.history.length > 0 ||
      snapshot.agent.latest ||
      snapshot.agent.decisions.length > 0 ||
      snapshot.vault.netCredited > 0 ||
      snapshot.vault.totalAllocated > 0 ||
      snapshot.vault.activeShares > 0 ||
      snapshot.vault.pendingShares > 0,
  );
}

function uniqueDefined(values: Array<string | undefined>) {
  return values.filter((value, index, arr): value is string => {
    if (!value) return false;
    return arr.findIndex((item) => item?.toLowerCase() === value.toLowerCase()) === index;
  });
}

function useAgoraSnapshot(userAddresses: string[]) {
  const [snapshot, setSnapshot] = useState<AgoraSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userKey = userAddresses.join("|");

  const refresh = useCallback(async (options?: { cancelled?: () => boolean; silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const candidates = userKey ? userKey.split("|").filter(Boolean) : [];
      if (candidates.length === 0) {
        const value = await getAgoraSnapshot();
        if (options?.cancelled?.()) return;
        setSnapshot(value);
        setError(null);
        return;
      }

      let firstSnapshot: AgoraSnapshot | null = null;
      let value: AgoraSnapshot | null = null;
      for (const candidate of candidates) {
        const candidateSnapshot = await getAgoraSnapshot(candidate);
        firstSnapshot ??= candidateSnapshot;
        if (snapshotHasUserData(candidateSnapshot)) {
          value = candidateSnapshot;
          break;
        }
      }
      value ??= firstSnapshot;
      if (!value) throw new Error("Could not load vault data");

      if (options?.cancelled?.()) return;
      setSnapshot(value);
      setError(null);
    } catch (err) {
      if (options?.cancelled?.()) return;
      setError(err instanceof Error ? err.message : "Could not load vault data");
    } finally {
      if (!options?.cancelled?.()) setLoading(false);
    }
  }, [userKey]);

  useEffect(() => {
    let cancelled = false;
    void refresh({ cancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return { snapshot, loading, error, refresh };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--border)]/70 py-3 last:border-0">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className="max-w-[58%] truncate text-right font-mono text-sm text-[var(--text)]">
        {value}
      </span>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">{label}</p>
      <p className="mt-2 font-mono text-2xl text-[var(--bone)]">{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--text-secondary)]">{sub}</p>}
    </div>
  );
}

function TooltipHeading({
  children,
  tooltip,
}: {
  children: ReactNode;
  tooltip: string;
}) {
  return (
    <span className="inline-flex items-center">
      {children}
      <InfoTooltip title={String(children)} text={tooltip} />
    </span>
  );
}

function formatDateLabel(value: number | string | null | undefined): string | null {
  if (value == null) return null;
  const date =
    typeof value === "number"
      ? new Date(value * 1000)
      : new Date(value.includes("T") ? value : `${value}T08:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStrategyName(strategy: string | null): string {
  if (!strategy) return "Awaiting agent deployment";
  if (strategy.toLowerCase() === "csp") return "Cash-secured put";
  return strategy
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatClaimStatus(status: string | null | undefined): string {
  if (!status) return "Not claimable yet";
  return status
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function numericField(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isDeployedPosition(item: AgoraHistoryItem) {
  return ["deployed", "assigned", "claimable"].includes(item.status);
}

function deployedPositions(snapshot: AgoraSnapshot) {
  return snapshot.history
    .filter(isDeployedPosition)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function positionCapital(item: AgoraHistoryItem) {
  return numericField(item.amount) ?? 0;
}

function positionPremium(item: AgoraHistoryItem) {
  return numericField(item.netPremium) ?? numericField(item.grossPremium) ?? 0;
}

function totalPositionCapital(items: AgoraHistoryItem[]) {
  return items.reduce((total, item) => total + positionCapital(item), 0);
}

function totalPositionPremium(items: AgoraHistoryItem[]) {
  return items.reduce((total, item) => total + positionPremium(item), 0);
}

function positionExpiryLabel(item: AgoraHistoryItem) {
  const rawExpiry = item.expiryDate ?? item.expiry;
  const label = formatDateLabel(rawExpiry);
  if (!label || !rawExpiry) return "Pending";

  const start = new Date(item.completed_at ?? item.createdAt);
  const expiry =
    typeof rawExpiry === "number"
      ? new Date(rawExpiry * 1000)
      : new Date(String(rawExpiry).includes("T") ? String(rawExpiry) : `${rawExpiry}T08:00:00Z`);
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(expiry.getTime())) {
    const days = (expiry.getTime() - start.getTime()) / 86_400_000;
    if (days > 3) return "Needs reconciliation";
  }
  return label;
}

function positionStrikeLabel(item: AgoraHistoryItem) {
  const strike =
    numericField(item.strike) ??
    numericField(item.selectedStrike) ??
    numericField(item.strikePrice) ??
    numericField(item.strike_price);
  return strike == null ? "Pending" : fmtUsd(strike);
}

function useSelectedQuote(decision: AgoraSnapshot["agent"]["latest"]) {
  const [selectedQuote, setSelectedQuote] = useState<PriceQuote | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSelectedQuote(null);
    if (!decision?.quoteId || !decision.selectedAsset) return;

    api.getPrices(decision.selectedAsset.toLowerCase())
      .then((quotes) => {
        if (cancelled) return;
        setSelectedQuote(quotes.find((quote) => quote.quote_id === decision.quoteId) ?? null);
      })
      .catch(() => {
        if (!cancelled) setSelectedQuote(null);
      });

    return () => {
      cancelled = true;
    };
  }, [decision?.quoteId, decision?.selectedAsset]);

  return selectedQuote;
}

function AllocationTimeline({ active }: { active?: AllocationProgress["lifecycleStatus"] }) {
  const steps: Array<{
    id: NonNullable<AllocationProgress["lifecycleStatus"]>;
    label: string;
  }> = [
    { id: "smart_wallet_approval_burn", label: "Smart wallet burn" },
    { id: "attesting", label: "Circle attesting" },
    { id: "minting_on_arc", label: "Minting on Arc" },
    { id: "finalize_bridge_deposit", label: "Finalize MetaVault" },
  ];
  const activeIndex = active ? steps.findIndex((step) => step.id === active) : -1;

  return (
    <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
        Allocation flow
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-5">
        {steps.map((step, index) => {
          const complete = index < activeIndex;
          const current = index === activeIndex;
          return (
            <div
              key={step.id}
              className={`rounded-md border px-3 py-2 text-xs ${
                complete
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                  : current
                    ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"
              }`}
            >
              <div className="flex items-center gap-2">
                {complete ? (
                  <Check className="h-3.5 w-3.5" />
                ) : current ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-current opacity-50" />
                )}
                <span>{step.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PreparedAllocationPanel({
  prepared,
  progress,
}: {
  prepared: AgoraPreparedAllocation;
  progress: AllocationProgress;
}) {
  const circleFee = prepared.circleFee ?? 0;
  const netAmount = prepared.netAmount ?? prepared.amount;

  return (
    <div className={`rounded-lg border p-4 ${
      progress.status === "error" || progress.status === "blocked"
        ? "border-amber-400/30 bg-amber-400/10"
        : "border-[var(--accent)]/30 bg-[var(--accent)]/10"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">
            {progress.title}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {progress.message}
          </p>
        </div>
        {["executing", "registering", "attesting", "minting", "finalizing"].includes(progress.status) ? (
          <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
        ) : progress.status === "submitted" || progress.status === "complete" ? (
          <Check className="h-4 w-4 text-emerald-300" />
        ) : (
          <span className="rounded-full border border-[var(--accent)]/30 px-2 py-1 font-mono text-xs text-[var(--accent)]">
            {prepared.id}
          </span>
        )}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <DetailRow label="Source" value={`${prepared.sourceChain} smart wallet`} />
        <DetailRow label="Gross amount" value={`${fmtAmount(prepared.amount)} USDC`} />
        {circleFee > 0 && (
          <>
            <DetailRow label="Circle fast fee" value={`${fmtAmount(circleFee)} USDC`} />
            <DetailRow label="Estimated credit" value={`${fmtAmount(netAmount)} USDC`} />
            <DetailRow
              label="CCTP mode"
              value={prepared.finalityThreshold === 1000 ? "Fast transfer" : "Standard"}
            />
          </>
        )}
        <DetailRow label="Receiver" value={truncate(prepared.receiverAddress)} />
        <DetailRow label="MetaVault" value={truncate(prepared.metaVaultAddress)} />
        {progress.txHash && (
          <DetailRow label="Burn tx" value={truncate(progress.txHash)} />
        )}
        {progress.intentId && (
          <DetailRow label="Intent" value={truncate(progress.intentId)} />
        )}
      </div>
      <AllocationTimeline active={progress.lifecycleStatus} />
      {prepared.actions.length > 0 && (
        <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
            On-chain actions
          </p>
          <div className="mt-2 space-y-2">
            {prepared.actions.map((action, index) => (
              <div
                key={`${action.kind}-${index}`}
                className="flex items-start justify-between gap-3 rounded-md bg-[var(--surface)] px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">
                    {index + 1}. {action.kind.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {action.description}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-[var(--text-secondary)]">
                  {truncate(action.to)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DepositView({
  sources,
  amount,
  setAmount,
  snapshot,
  nextDeploymentLabel,
  prepared,
  progress,
  preparing,
  onPrepare,
}: {
  sources: SourceBalance[];
  amount: string;
  setAmount: (value: string) => void;
  snapshot: AgoraSnapshot;
  nextDeploymentLabel: string;
  prepared: AgoraPreparedAllocation | null;
  progress: AllocationProgress;
  preparing: boolean;
  onPrepare: () => void;
}) {
  const numericAmount = Number(amount);
  const totalBalance = sources.reduce((sum, source) => sum + source.balance, 0);
  const allocatableBalance = sources
    .filter((source) => source.enabled)
    .reduce((sum, source) => sum + source.balance, 0);
  const claimablePremiums = snapshot.vault.claimablePremiums ?? 0;
  const premiumStatus = claimablePremiums > 0 ? "Claimable now" : "Claimable Mondays";
  const canPrepare =
    sources.some((source) => source.enabled && source.wallet && source.balance > 0) &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    numericAmount <= allocatableBalance;
  const estimatedCredit = numericAmount > 0 && numericAmount <= allocatableBalance
    ? `${fmtAmount(numericAmount)} USDC`
    : "Enter amount";

  return (
    <div className="space-y-5">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-[var(--border)] bg-[#101012] p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Deposit</p>
            <h2 className="mt-2 text-3xl font-semibold text-[var(--bone)]">
              Allocate USDC to the vault
            </h2>
            <div className="mt-3 flex items-center text-sm text-[var(--text-secondary)]">
              <span>Uses your existing b1nary smart wallet balance.</span>
              <InfoTooltip
                title="Allocation path"
                text="The backend handles CCTP to Arc and credits the MetaVault. This is not a manual bridge screen."
              />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Metric label="Available" value={fmtUsd(totalBalance)} sub="Smart wallets" />
            <Metric label="In vault" value={fmtUsd(snapshot.vault.netCredited)} sub={agoraStatusLabel(snapshot.vault.status)} />
            <Metric label="Premiums" value={fmtUsd(claimablePremiums)} sub={premiumStatus} />
          </div>

          <div className="mt-7 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4">
            <label className="text-sm font-medium text-[var(--text)]" htmlFor="vault-amount">
              Amount
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="flex min-h-12 flex-1 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-3">
                <input
                  id="vault-amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="min-w-0 flex-1 bg-transparent font-mono text-xl text-[var(--text)] outline-none"
                />
                <span className="pl-3 text-sm text-[var(--text-secondary)]">USDC</span>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={allocatableBalance <= 0}
                onClick={() => setAmount(String(allocatableBalance))}
                className="border-[var(--border)]"
              >
                Max
              </Button>
            </div>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Available now: {fmtAmount(allocatableBalance)} USDC
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              disabled={!canPrepare || preparing}
              onClick={onPrepare}
              className="min-h-11 bg-[var(--accent)] px-5 text-black hover:bg-[var(--accent-hover)]"
            >
              {preparing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              Deposit to Agent Vault
            </Button>
            {!canPrepare && (
              <p className="text-sm text-[var(--text-secondary)]">
                Enter an amount within the available balance.
              </p>
            )}
          </div>

          {prepared && (
            <div className="mt-5">
              <PreparedAllocationPanel prepared={prepared} progress={progress} />
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--text)]">
                <TooltipHeading tooltip="The agent never has custody and cannot withdraw user funds. The vault holds capital and enforces allowed actions.">
                  Vault rules
                </TooltipHeading>
              </h3>
            </div>
            <div className="mt-4">
              <DetailRow label="Estimated credit" value={estimatedCredit} />
              <DetailRow label="Agent access" value="Strategy only" />
              <DetailRow label="Claim schedule" value="Every Monday" />
            </div>
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-5">
            <h3 className="text-sm font-semibold text-[var(--text)]">Next cycle</h3>
            <DetailRow label="Deployment" value={nextDeploymentLabel} />
            <DetailRow label="Epoch" value={String(snapshot.vault.currentEpoch ?? "-")} />
          </section>
        </aside>
      </section>
    </div>
  );
}

function MyVaultView({
  snapshot,
  nextDeploymentLabel,
}: {
  snapshot: AgoraSnapshot;
  nextDeploymentLabel: string;
}) {
  const vault = snapshot.vault;
  const positions = deployedPositions(snapshot);
  const activeCapital = vault.activePositionCollateral ?? totalPositionCapital(positions);
  const idleCapital = Math.max(0, vault.netCredited - activeCapital);
  const collectedPremium = vault.accruedPremiums ?? totalPositionPremium(positions);
  const activePositionCount = vault.activePositionCount ?? positions.filter((item) => item.status === "deployed").length;
  const claimStatus = positions.find((item) => item.premiumClaimStatus)?.premiumClaimStatus;
  return (
    <div className="space-y-6">
      <SelectedPositionDashboard snapshot={snapshot} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Vault balance" value={fmtUsd(vault.netCredited)} sub="Total credited capital" />
        <Metric label="Deployed" value={fmtUsd(activeCapital)} sub={`${activePositionCount} active position${activePositionCount === 1 ? "" : "s"}`} />
        <Metric label="Idle" value={fmtUsd(idleCapital)} sub="Available for next cycle" />
        <Metric label="Premium collected" value={fmtPremiumUsd(collectedPremium)} sub={formatClaimStatus(claimStatus ?? snapshot.agent.latest?.premiumClaimStatus)} />
      </div>
      <PositionList positions={positions} />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-5">
          <h2 className="text-sm font-semibold text-[var(--text)]">Cycle timing</h2>
          <div className="mt-3">
            <DetailRow label="Current epoch" value={vault.currentEpoch == null ? "-" : String(vault.currentEpoch)} />
            <DetailRow label="Activates epoch" value={vault.activationEpoch == null ? "-" : String(vault.activationEpoch)} />
            <DetailRow label="Next deployment" value={nextDeploymentLabel} />
            <DetailRow label="Auto-compound" value={vault.autoCompound ? "On" : "Off"} />
          </div>
        </section>
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-5">
          <h2 className="text-sm font-semibold text-[var(--text)]">Vault controls</h2>
          <div className="mt-3">
            <DetailRow label="Custody" value="MetaVault" />
            <DetailRow label="Agent access" value="Strategy only" />
            <DetailRow label="Assignment" value="Rotate or repeat" />
            <DetailRow label="Claims" value="Mondays" />
          </div>
        </section>
      </div>
    </div>
  );
}

function SelectedPositionDashboard({ snapshot }: { snapshot: AgoraSnapshot }) {
  const positions = deployedPositions(snapshot);
  const latestPosition = positions[0];
  const activeCapital = snapshot.vault.activePositionCollateral ?? totalPositionCapital(positions);
  const premiumCollected = snapshot.vault.accruedPremiums ?? totalPositionPremium(positions);
  const userClaimablePremium = snapshot.vault.userClaimablePremiums ?? snapshot.vault.claimablePremiums ?? 0;
  const vaultCollectedPremium = snapshot.vault.vaultPremiumsCollected ?? snapshot.vault.totalPremiumsCollected ?? null;
  const claimStatus = formatClaimStatus(latestPosition?.premiumClaimStatus);
  const latestAsset = (latestPosition?.selectedAsset ?? "No active").toUpperCase();
  const latestStrategy = formatStrategyName(latestPosition?.selectedStrategy ?? null);
  const latestExpiry = latestPosition ? positionExpiryLabel(latestPosition) : "Pending";
  const latestStrike = latestPosition ? positionStrikeLabel(latestPosition) : "Pending";

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[#101012] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">
              {positions.length > 0 ? "Active positions" : "Waiting for deployment"}
            </span>
            <span className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              Vault deployment
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--bone)]">
            {positions.length > 0
              ? `${positions.length} ${positions.length === 1 ? "position" : "positions"} deployed`
              : "Capital waiting for agent deployment"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            {positions.length > 0
              ? `Latest: ${latestAsset} ${latestStrategy} on ${latestPosition?.selectedChain ?? "base"}. Premiums are accumulated across every position opened by the vault.`
              : "Capital is in the vault. The agent has not opened a position for this cycle yet."}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4 lg:min-w-64">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Premium collected</p>
          <p className="mt-2 font-mono text-3xl text-[var(--bone)]">{fmtPremiumUsd(premiumCollected)}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {`${claimStatus} · claimable ${fmtPremiumUsd(userClaimablePremium)}${vaultCollectedPremium == null ? "" : ` · ${fmtPremiumUsd(vaultCollectedPremium)} vault total`}`}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Capital deployed</p>
          <p className="mt-2 font-mono text-2xl text-[var(--bone)]">{fmtUsd(activeCapital)}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Latest strike</p>
          <p className="mt-2 font-mono text-2xl text-[var(--bone)]">{latestStrike}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Latest expiry</p>
          <p className="mt-2 font-mono text-2xl text-[var(--bone)]">{latestExpiry}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Positions</p>
          <p className="mt-2 font-mono text-2xl text-[var(--bone)]">{positions.length}</p>
        </div>
      </div>
    </section>
  );
}

function PositionList({ positions }: { positions: AgoraHistoryItem[] }) {
  if (positions.length === 0) return null;

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <h2 className="text-sm font-semibold text-[var(--text)]">Positions opened</h2>
        <span className="text-xs text-[var(--text-secondary)]">
          {positions.length} opened
        </span>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {positions.map((position) => {
          const asset = (position.selectedAsset ?? "Asset").toUpperCase();
          const strategy = formatStrategyName(position.selectedStrategy ?? null);
          const capital = positionCapital(position);
          const premium = positionPremium(position);
          const strike = positionStrikeLabel(position);
          const expiry = positionExpiryLabel(position);
          const chain = position.selectedChain ?? position.sourceChain;
          const quote = position.selectedQuoteId ?? "pending";
          const status = agoraStatusLabel(position.status);

          return (
            <div key={position.id} className="grid gap-4 px-5 py-4 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] md:items-center">
              <div>
                <p className="font-medium text-[var(--bone)]">{asset} {strategy}</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {chain} · quote {quote}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Capital</p>
                <p className="mt-1 font-mono text-sm text-[var(--text)]">{fmtAmount(capital)} USDC</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Premium</p>
                <p className="mt-1 font-mono text-sm text-[var(--text)]">{fmtPremiumUsd(premium)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Strike</p>
                <p className={`mt-1 font-mono text-sm ${strike === "Pending" ? "text-amber-200" : "text-[var(--text)]"}`}>
                  {strike}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Expiry</p>
                <p className={`mt-1 font-mono text-sm ${expiry === "Needs reconciliation" ? "text-amber-200" : "text-[var(--text)]"}`}>
                  {expiry}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{status}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TxValue({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <span className="rounded-md border border-[var(--border)] px-2 py-1 font-mono text-xs text-[var(--text-secondary)]">
      {label}: {truncate(value)}
    </span>
  );
}

function HistoryItemRow({ item }: { item: AgoraHistoryItem }) {
  const deploymentTx = item.deploymentTxHash ?? item.destinationTxHash ?? item.destinationTx ?? item.destination_tx ?? null;
  const hasAgentDeployment = ["deployed", "assigned", "claimable"].includes(item.status);
  const selectedMarket = [item.selectedAsset?.toUpperCase(), item.selectedChain]
    .filter(Boolean)
    .join(" on ");
  const agentSummary = hasAgentDeployment
    ? `${formatStrategyName(item.selectedStrategy)} deployed`
    : formatStrategyName(item.selectedStrategy);
  const quoteSummary = [
    selectedMarket,
    hasAgentDeployment && item.selectedQuoteId ? `quote ${item.selectedQuoteId}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-1 text-xs ${statusTone(item.status)}`}>
              {agoraStatusLabel(item.status)}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {new Date(item.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="mt-3 text-sm text-[var(--text)]">
            {fmtAmount(item.amount)} USDC from {item.sourceChain} smart wallet
          </p>
          <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
            {truncate(item.sourceWallet)}
          </p>
          {hasAgentDeployment && (
            <p className="mt-2 text-sm text-emerald-200">
              Agent deployed this allocation into the selected position.
            </p>
          )}
          {item.failureReason && (
            <p className="mt-2 text-sm text-red-300">{item.failureReason}</p>
          )}
        </div>
        <div className="text-left md:text-right">
          <p className="text-sm text-[var(--text)]">
            {agentSummary}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {hasAgentDeployment ? quoteSummary || "Position details pending" : "No agent position yet"}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <TxValue label="burn" value={item.burnTxHash} />
        <TxValue label="receiveMessage" value={item.arcReceiveTxHash} />
        <TxValue label="finalize" value={item.finalizeTxHash} />
        {hasAgentDeployment && (
          <>
            <TxValue label="decision" value={item.agentDecisionHash} />
            <TxValue label="deployment" value={deploymentTx} />
          </>
        )}
      </div>
    </article>
  );
}

function HistoryView({ snapshot }: { snapshot: AgoraSnapshot }) {
  if (snapshot.history.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center">
        <History className="mx-auto h-8 w-8 text-[var(--text-secondary)]" />
        <p className="mt-4 text-lg font-semibold text-[var(--text)]">No vault history yet</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Prepared allocations and Arc lifecycle events will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {snapshot.history.map((item) => (
        <HistoryItemRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function AgentField({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">
        <span className="text-[var(--accent)]">{icon}</span>
        {label}
      </div>
      <p className="mt-3 font-mono text-2xl text-[var(--bone)]">{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--text-secondary)]">{sub}</p>}
    </div>
  );
}

function AgentView({ snapshot }: { snapshot: AgoraSnapshot }) {
  const latest = snapshot.agent.latest;
  const selectedQuote = useSelectedQuote(latest);

  if (!latest) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center">
        <Bot className="mx-auto h-8 w-8 text-[var(--text-secondary)]" />
        <p className="mt-4 text-lg font-semibold text-[var(--text)]">No agent decision yet</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          The agent trace will populate after the first allocation is evaluated.
        </p>
      </div>
    );
  }

  const strategyLabel = formatStrategyName(latest.selectedStrategy);
  const assetLabel = latest.selectedAsset?.toUpperCase() ?? "Asset";
  const chainLabel = latest.selectedChain
    ? latest.selectedChain.charAt(0).toUpperCase() + latest.selectedChain.slice(1)
    : "Available venue";
  const sizeLabel = latest.size == null ? "Pending" : `${fmtAmount(latest.size)} USDC`;
  const vaultCapital = snapshot.vault.netCredited || snapshot.vault.activeShares || snapshot.vault.pendingShares;
  const selectedSize = latest.size ?? 0;
  const reserveSize = Math.max(0, vaultCapital - selectedSize);
  const vaultCapitalLabel = fmtUsd(vaultCapital);
  const reserveLabel = `${fmtAmount(reserveSize)} USDC`;
  const agentPremium = numericField(latest.netPremium) ?? numericField(latest.grossPremium) ?? numericField(latest.expectedPremium);
  const premiumLabel = agentPremium == null ? "Pending" : fmtPremiumUsd(agentPremium);
  const traceText = latest.trace.join(" ");
  const aprMatch = traceText.match(/Premium APR proxy is ([\d.]+)%/i);
  const expiryMatch = traceText.match(/Expiry is (\d+) days?/i);
  const distanceMatch = traceText.match(/distance to strike is ([\d.]+)%/i);
  const riskMatch = traceText.match(/assignment risk proxy is ([\d.]+)%/i);
  const explicitStrike = latest.strike ?? latest.strikePrice ?? null;
  const explicitExpiryDate =
    typeof latest.expiry === "string"
      ? latest.expiry
      : latest.expiryDate ?? null;
  const explicitExpiryTimestamp =
    typeof latest.expiry === "number" ? latest.expiry : null;
  const strikeLabel =
    selectedQuote?.strike != null
      ? fmtUsd(selectedQuote.strike)
      : explicitStrike != null
        ? fmtUsd(explicitStrike)
        : latest.quoteId
          ? "Quote selected"
          : "Pending";
  const expiryLabel = selectedQuote?.expiry_date
    ? new Date(`${selectedQuote.expiry_date}T08:00:00Z`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : explicitExpiryDate
      ? new Date(explicitExpiryDate).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : explicitExpiryTimestamp
        ? new Date(explicitExpiryTimestamp * 1000).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : expiryMatch ? `${expiryMatch[1]} days` : "Pending";
  const aprLabel =
    latest.premiumApr != null
      ? `${latest.premiumApr.toFixed(2)}% APR`
      : aprMatch ? `${aprMatch[1]}% APR` : "Policy passed";
  const distanceLabel =
    latest.distanceToStrike != null
      ? `${latest.distanceToStrike.toFixed(2)}% OTM`
      : distanceMatch ? `${distanceMatch[1]}% OTM` : "Within policy";
  const riskLabel =
    latest.assignmentRisk != null
      ? `${latest.assignmentRisk.toFixed(2)}% risk`
      : riskMatch ? `${riskMatch[1]}% risk` : "Checked";
  const decisionSummary =
    selectedQuote
      ? `The agent chose a ${assetLabel} ${strategyLabel.toLowerCase()} at ${strikeLabel}, expiring ${expiryLabel}.`
      : latest.trace.find((line) => line.toLowerCase().startsWith("selected ")) ??
        `The agent selected ${strategyLabel} for the next eligible vault deployment.`;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[var(--border)] bg-[#101012] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
              Latest agent decision
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-[var(--bone)]">
              {assetLabel} {strategyLabel}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              {decisionSummary}
            </p>
          </div>
          <div className="w-full rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4 lg:w-72">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Selected capital</p>
            <p className="mt-2 font-mono text-3xl text-[var(--bone)]">{sizeLabel}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {reserveLabel} remains idle in the vault
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <AgentField
            icon={<Target className="h-4 w-4" />}
            label="Strike"
            value={strikeLabel}
            sub={`${assetLabel} ${strategyLabel}`}
          />
          <AgentField
            icon={<CalendarDays className="h-4 w-4" />}
            label="Expiry"
            value={expiryLabel}
            sub={selectedQuote?.expiry_days ? `${selectedQuote.expiry_days} days` : "Selected tenor"}
          />
          <AgentField
            icon={<CircleDollarSign className="h-4 w-4" />}
            label="Premium"
            value={premiumLabel}
            sub={aprLabel}
          />
          <AgentField
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Venue"
            value={chainLabel}
            sub="Vault keeps custody"
          />
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Why it passed</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              The agent selected one eligible short-dated position and left the rest of the vault idle.
            </p>
          </div>
          <span className="font-mono text-xs text-[var(--text-secondary)]">
            {truncate(latest.decisionHash)}
          </span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Distance</p>
              <p className="mt-2 font-mono text-xl text-[var(--bone)]">{distanceLabel}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">from spot</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Assignment</p>
              <p className="mt-2 font-mono text-xl text-[var(--bone)]">{riskLabel}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">agent estimate</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Selected size</p>
              <p className="mt-2 font-mono text-xl text-[var(--bone)]">{sizeLabel}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">of {vaultCapitalLabel}</p>
            </div>
        </div>
      </section>
    </div>
  );
}

export function VaultPageClient() {
  const { user } = usePrivy();
  const {
    address,
    fundingAddress,
    portfolioAddresses,
    sendBatchTx,
    solanaAddress,
    isConnected,
  } = useWallet();
  const baseAddresses = Array.from(new Set([
    ...(portfolioAddresses.base as Address[]),
    address,
    fundingAddress,
  ].filter(Boolean))) as Address[];
  const solanaAddresses = portfolioAddresses.solana;
  const { account: b1naryAccount, wallets: b1naryWallets } = useB1naryAccount({
    autoSyncTrustedWallets: false,
  });
  const [view, setView] = useState<View>("deposit");
  const [amount, setAmount] = useState("");
  const [prepared, setPrepared] = useState<AgoraPreparedAllocation | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [allocationProgress, setAllocationProgress] = useState<AllocationProgress>({
    status: "idle",
    title: "Ready",
    message: "Enter an amount to deposit into the Agent Vault.",
  });
  const [now, setNow] = useState(() => new Date());

  const baseTradingWallets = useMemo(
    () =>
      b1naryWallets
        .filter((wallet) => wallet.chain === "base" && wallet.role === "trading" && wallet.wallet_type === "smart")
        .map((wallet) => wallet.address as Address),
    [b1naryWallets],
  );
  const solanaTradingWallets = useMemo(
    () =>
      b1naryWallets
        .filter((wallet) => wallet.chain === "solana" && wallet.role === "trading")
        .map((wallet) => wallet.address),
    [b1naryWallets],
  );

  const baseBalanceAddresses = baseTradingWallets.length > 0
    ? baseTradingWallets
    : baseAddresses.length > 0
      ? baseAddresses
      : address;
  const solanaBalanceAddresses = solanaTradingWallets.length > 0
    ? solanaTradingWallets
    : solanaAddresses.length > 0
      ? solanaAddresses
      : solanaAddress;

  const baseBalances = useBalances(baseBalanceAddresses);
  const solanaBalances = useSolanaBalance(solanaBalanceAddresses);
  const agoraUserCandidates = useMemo(
    () =>
      uniqueDefined([
        user?.id,
        b1naryAccount?.id,
        ...baseTradingWallets,
        fundingAddress,
        address,
        ...baseAddresses,
        ...solanaTradingWallets,
        solanaAddress,
        ...solanaAddresses,
      ]),
    [
      address,
      baseAddresses,
      baseTradingWallets,
      b1naryAccount?.id,
      fundingAddress,
      solanaAddress,
      solanaAddresses,
      solanaTradingWallets,
      user?.id,
    ],
  );
  const primaryUserAddress = agoraUserCandidates[0];
  const { snapshot, loading, error, refresh: refreshSnapshot } = useAgoraSnapshot(agoraUserCandidates);
  const deploymentDate = useMemo(() => nextDeploymentDate(now), [now]);
  const nextDeploymentLabel = useMemo(
    () => formatTimeUntil(deploymentDate, now),
    [deploymentDate, now],
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const sources = useMemo<SourceBalance[]>(() => {
    const baseWallet = baseTradingWallets[0] ?? baseAddresses[0] ?? address ?? null;
    const solWallet = solanaTradingWallets[0] ?? solanaAddresses[0] ?? solanaAddress ?? null;
    const registry = snapshot?.registry;
    return [
      {
        chain: "base",
        label: "Base smart wallet",
        wallet: baseWallet,
        walletType: "Smart",
        balance: baseBalances.usd,
        balanceRaw: baseBalances.usdRaw,
        enabled: Boolean(baseWallet && registry?.basePathReady !== false),
        note: registry?.basePathReady === false
          ? "Backend path is not ready."
          : "Primary source for Agora allocation.",
      },
      {
        chain: "solana",
        label: "Solana smart wallet",
        wallet: solWallet,
        walletType: "Embedded",
        balance: solanaBalances.solanaUsdc,
        balanceRaw: solanaBalances.solanaUsdcRaw,
        enabled: Boolean(solWallet && registry?.solanaPathReady),
        note: registry?.solanaPathReady
          ? "Solana allocation path is enabled."
          : "Visible for balance; allocation is disabled until backend path is ready.",
      },
    ];
  }, [
    address,
    baseAddresses,
    baseBalances.usd,
    baseBalances.usdRaw,
    baseTradingWallets,
    snapshot?.registry,
    solanaAddress,
    solanaAddresses,
    solanaBalances.solanaUsdc,
    solanaBalances.solanaUsdcRaw,
    solanaTradingWallets,
  ]);

  const allocationSource = useMemo(() => {
    const requested = Number(amount);
    const enabledSources = sources.filter((source) => source.enabled && source.wallet);
    return (
      enabledSources.find((source) => Number.isFinite(requested) && requested > 0 && source.balance >= requested) ??
      enabledSources.find((source) => source.balance > 0) ??
      enabledSources[0] ??
      null
    );
  }, [amount, sources]);

  async function handlePrepare() {
    if (!allocationSource?.wallet || !snapshot) return;
    setPreparing(true);
    setPrepared(null);
    let submittedTxHash: string | null = null;
    setAllocationProgress({
      status: "preparing",
      title: "Preparing allocation",
      message: "Creating the vault allocation and fetching smart-wallet actions.",
    });
    try {
      const result = await prepareAgoraAllocation({
        userId: user?.id ?? null,
        sourceChain: allocationSource.chain,
        sourceWallet: allocationSource.wallet,
        amount: Number(amount),
        receiverAddress: snapshot.registry.receiverAddress,
        metaVaultAddress: snapshot.registry.metaVaultAddress,
      });
      setPrepared(result);
      if (result.disabled_reason) {
        setAllocationProgress({
          status: "blocked",
          title: "Allocation not executable yet",
          message: result.disabled_reason,
        });
        return;
      }
      if (result.actions.length === 0) {
        setAllocationProgress({
          status: "blocked",
          title: "No on-chain action returned",
          message:
            result.mode === "demo"
              ? "The backend did not return an executable allocation. Check API routing before retrying."
              : "The backend prepared the allocation, but did not return smart-wallet actions.",
        });
        return;
      }
      if (result.actions.some((action) => action.chain !== "base")) {
        setAllocationProgress({
          status: "blocked",
          title: "Unsupported source for V1",
          message: "Only Base smart-wallet allocation actions can be executed from this screen right now.",
        });
        return;
      }

      setAllocationProgress({
        status: "executing",
        title: "Executing smart-wallet actions",
        message: "Approving USDC and starting the CCTP burn from the smart wallet.",
        lifecycleStatus: "smart_wallet_approval_burn",
      });
      const calls: BatchCall[] = result.actions.map((action) => ({
        to: action.to as Address,
        data: action.data as `0x${string}`,
        value: BigInt(action.value || "0"),
      }));
      const txHash = await sendBatchTx(calls);
      if (typeof txHash !== "string" || !txHash.startsWith("0x")) {
        throw new Error("Smart wallet did not return a transaction hash.");
      }
      submittedTxHash = txHash;
      setAllocationProgress({
        status: "registering",
        title: "Burn submitted",
        message: "Registering the deposit intent so the relayer can continue the Arc flow.",
        txHash,
        lifecycleStatus: "attesting",
      });

      const receiverAddress = result.receiverAddress ?? snapshot.registry.receiverAddress;
      const metaVaultAddress = result.metaVaultAddress ?? snapshot.registry.metaVaultAddress;
      const amountRaw = result.amount_raw ?? String(Math.round(result.amount * 1_000_000));
      if (!receiverAddress || !metaVaultAddress) {
        throw new Error("Receiver or MetaVault address is missing from the allocation.");
      }

      const onchainIntentId = buildOnchainIntentId({
        allocationId: result.allocation_id ?? result.id,
        txHash,
        sourceWallet: result.sourceWallet,
        amountRaw,
      });
      const allocationId = result.allocation_id ?? result.id;
      const intentKey = `${allocationId}:${txHash}`;
      const intentResponse = await createAgoraDepositIntent({
        userId: user?.id ?? primaryUserAddress ?? result.sourceWallet,
        sourceChain: "base",
        sourceWallet: result.sourceWallet,
        burnTxHash: txHash,
        receiverAddress,
        metaVaultAddress,
        amountRaw,
        onchainIntentId,
        idempotencyKey: intentKey,
        quoteId: intentKey,
      });
      setAllocationProgress(progressFromCapitalIntent(intentResponse.intent, txHash));
      await refreshSnapshot({ silent: true });

      let latestIntent = intentResponse.intent;
      for (let attempt = 0; attempt < 36; attempt += 1) {
        if (["waiting_to_be_deployed", "deployed", "completed", "failed", "retryable"].includes(latestIntent.status)) {
          break;
        }
        await sleep(5_000);
        latestIntent = await getAgoraCapitalIntent(intentResponse.intent.id);
        setAllocationProgress(progressFromCapitalIntent(latestIntent, txHash));
        await refreshSnapshot({ silent: true });
      }
    } catch (err) {
      setAllocationProgress({
        status: "error",
        title: submittedTxHash ? "Burn submitted, registration failed" : "Allocation failed",
        message: submittedTxHash
          ? `Burn tx ${truncate(submittedTxHash)} was submitted, but the relayer intent could not be registered: ${err instanceof Error ? err.message : "unknown error"}`
          : err instanceof Error ? err.message : "Could not execute allocation.",
        txHash: submittedTxHash ?? undefined,
        lifecycleStatus: submittedTxHash ? "attesting" : undefined,
      });
    } finally {
      setPreparing(false);
    }
  }

  if (!isConnected) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 p-10 text-center">
          <Wallet className="mx-auto h-9 w-9 text-[var(--accent)]" />
          <h1 className="mt-4 text-2xl font-semibold text-[var(--bone)]">Connect your wallet</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            The Agent Vault starts from your existing b1nary smart wallet balances.
          </p>
        </div>
      </main>
    );
  }

  if (loading || !snapshot) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="h-80 animate-pulse rounded-lg bg-[var(--surface)]" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Agora vault</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--bone)] sm:text-4xl">
            Agent Vault
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-[var(--text-secondary)]">
            Deposit USDC. The vault keeps funds safe while the agent selects 1-day income strategies.
          </p>
          {error && <p className="mt-2 text-sm text-amber-200">{error}</p>}
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          Epoch {snapshot.vault.currentEpoch ?? "-"} · deploys in {nextDeploymentLabel}
        </div>
      </section>

      <div className="mb-6 flex gap-2 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]/50 p-1">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={`min-h-10 shrink-0 rounded-md px-4 text-sm transition-colors ${
              view === item.id
                ? "bg-[var(--accent)] text-black"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === "deposit" && (
        <DepositView
          sources={sources}
          amount={amount}
          setAmount={setAmount}
          snapshot={snapshot}
          nextDeploymentLabel={nextDeploymentLabel}
          prepared={prepared}
          progress={allocationProgress}
          preparing={preparing}
          onPrepare={handlePrepare}
        />
      )}
      {view === "vault" && (
        <MyVaultView
          snapshot={snapshot}
          nextDeploymentLabel={nextDeploymentLabel}
        />
      )}
      {view === "history" && <HistoryView snapshot={snapshot} />}
      {view === "agent" && <AgentView snapshot={snapshot} />}
    </main>
  );
}
