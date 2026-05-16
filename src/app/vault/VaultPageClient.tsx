"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowRight, Bot, Copy, History, Loader2, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import type { Address } from "viem";
import { useB1naryAccount } from "@/hooks/useB1naryAccount";
import { useBalances } from "@/hooks/useBalances";
import { useSolanaBalance } from "@/hooks/useSolanaBalance";
import { useWalletSummary } from "@/hooks/useWalletSummary";
import {
  agoraStatusLabel,
  getAgoraSnapshot,
  prepareAgoraAllocation,
  type AgoraHistoryItem,
  type AgoraPreparedAllocation,
  type AgoraSnapshot,
  type AgoraSourceChain,
} from "@/lib/agora";
import { Button } from "@/components/ui/button";

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

const VIEWS: Array<{ id: View; label: string }> = [
  { id: "deposit", label: "Overview" },
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

function useAgoraSnapshot(userAddress?: string) {
  const [snapshot, setSnapshot] = useState<AgoraSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAgoraSnapshot(userAddress)
      .then((value) => {
        if (cancelled) return;
        setSnapshot(value);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load vault data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userAddress]);

  return { snapshot, loading, error };
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

function GuidedWalkthrough() {
  const steps = [
    {
      title: "Deposit USDC",
      body: "Choose how much idle USDC you want the vault to manage.",
    },
    {
      title: "Pick a 1-day strike",
      body: "The agent looks for the best short-dated strike for the current market.",
    },
    {
      title: "Manage assignment",
      body: "If the vault is assigned, the agent opens the next position. If not, it repeats.",
    },
    {
      title: "Claim on Monday",
      body: "Premiums accumulate through the cycle and can be claimed every Monday.",
    },
  ];

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/55 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[var(--accent)]" />
        <h2 className="text-sm font-semibold text-[var(--text)]">How the vault works</h2>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.title} className="relative">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 font-mono text-xs text-[var(--accent)]">
              {index + 1}
            </span>
            <h3 className="mt-3 text-sm font-semibold text-[var(--bone)]">{step.title}</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PreparedAllocationPanel({
  prepared,
}: {
  prepared: AgoraPreparedAllocation;
}) {
  return (
    <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">Allocation prepared</p>
          <p className="text-xs text-[var(--text-secondary)]">
            {prepared.mode === "api"
              ? "Backend returned an allocation payload."
              : "Demo payload ready until direct smart-wallet execution is wired."}
          </p>
        </div>
        <span className="rounded-full border border-[var(--accent)]/30 px-2 py-1 font-mono text-xs text-[var(--accent)]">
          {prepared.id}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <DetailRow label="Source" value={`${prepared.sourceChain} smart wallet`} />
        <DetailRow label="Amount" value={`${fmtAmount(prepared.amount)} USDC`} />
        <DetailRow label="Receiver" value={truncate(prepared.receiverAddress)} />
        <DetailRow label="MetaVault" value={truncate(prepared.metaVaultAddress)} />
      </div>
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
  preparing,
  onPrepare,
}: {
  sources: SourceBalance[];
  amount: string;
  setAmount: (value: string) => void;
  snapshot: AgoraSnapshot;
  nextDeploymentLabel: string;
  prepared: AgoraPreparedAllocation | null;
  preparing: boolean;
  onPrepare: () => void;
}) {
  const numericAmount = Number(amount);
  const totalBalance = sources.reduce((sum, source) => sum + source.balance, 0);
  const allocatableBalance = sources
    .filter((source) => source.enabled)
    .reduce((sum, source) => sum + source.balance, 0);
  const canPrepare =
    sources.some((source) => source.enabled && source.wallet && source.balance > 0) &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    numericAmount <= allocatableBalance;

  return (
    <div className="space-y-6">
      <GuidedWalkthrough />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-lg border border-[var(--border)] bg-[#101012] p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Agent-managed income vault</p>
            <h2 className="mt-2 text-3xl font-semibold text-[var(--bone)]">
              Put idle USDC to work
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Deposit once from your existing b1nary balance. The vault moves capital to Arc, credits your shares, and lets the agent choose the next deployment.
            </p>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <Metric label="Available" value={fmtUsd(totalBalance)} sub="Base + Solana smart wallets" />
            <Metric label="In vault" value={fmtUsd(snapshot.vault.netCredited)} sub={agoraStatusLabel(snapshot.vault.status)} />
            <Metric label="Next deploy" value={nextDeploymentLabel} sub={`Epoch ${snapshot.vault.currentEpoch ?? "-"}`} />
          </div>

          <div className="mt-7 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4">
          <label className="text-sm font-medium text-[var(--text)]" htmlFor="vault-amount">
            Deposit amount
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
            Available to allocate now: {fmtAmount(allocatableBalance)} USDC
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
              Enter an amount within the available smart wallet balance.
            </p>
          )}
        </div>

        {prepared && <div className="mt-5"><PreparedAllocationPanel prepared={prepared} /></div>}
        </div>

        <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text)]">Funds stay in the vault</h3>
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
            The agent never has custody of user funds and cannot withdraw them. Capital is held by the vault, which enforces the allowed actions.
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            The agent only manages the strategy: it chooses the best eligible strike, handles the next step after assignment, and repeats the cycle when the vault is not assigned.
          </p>
          <div className="mt-5">
            <DetailRow label="Estimated credit" value={numericAmount > 0 ? `${fmtAmount(numericAmount)} USDC` : "Enter amount"} />
            <DetailRow label="Claim schedule" value="Every Monday" />
            <DetailRow label="Next deployment" value={nextDeploymentLabel} />
            <DetailRow label="Agent access" value="Strategy only" />
          </div>
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
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="In vault" value={fmtUsd(vault.netCredited)} sub={agoraStatusLabel(vault.status)} />
        <Metric label="Claimable" value={fmtUsd(vault.claimablePremiums)} sub="Available every Monday" />
        <Metric label="Current epoch" value={vault.currentEpoch == null ? "-" : String(vault.currentEpoch)} sub="Vault accounting cycle" />
        <Metric label="Next deployment" value={nextDeploymentLabel} sub={vault.activationEpoch == null ? "Next eligible epoch" : `Activates epoch ${vault.activationEpoch}`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(320px,0.7fr)]">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-5">
          <h2 className="text-lg font-semibold text-[var(--bone)]">Capital status</h2>
          <div className="mt-3">
            <DetailRow label="Pending shares" value={fmtAmount(vault.pendingShares)} />
            <DetailRow label="Active shares" value={fmtAmount(vault.activeShares)} />
            <DetailRow label="Next capital deployment" value={nextDeploymentLabel} />
            <DetailRow label="Auto-compound" value={vault.autoCompound ? "On" : "Off"} />
          </div>
        </section>
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-5">
          <h2 className="text-lg font-semibold text-[var(--bone)]">Managed by policy</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            The agent can choose the next 1-day strategy, but the vault keeps custody and enforces the allowed actions.
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            If assigned, it opens the next position. If not assigned, it searches again and repeats the cycle.
          </p>
        </section>
      </div>
    </div>
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
          {item.failureReason && (
            <p className="mt-2 text-sm text-red-300">{item.failureReason}</p>
          )}
        </div>
        <div className="text-left md:text-right">
          <p className="text-sm text-[var(--text)]">
            {item.selectedStrategy ?? "Awaiting agent deployment"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {[item.selectedChain, item.selectedAsset, item.selectedQuoteId].filter(Boolean).join(" / ") || "No quote selected yet"}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <TxValue label="burn" value={item.burnTxHash} />
        <TxValue label="receiveMessage" value={item.arcReceiveTxHash} />
        <TxValue label="finalize" value={item.finalizeTxHash} />
        <TxValue label="decision" value={item.agentDecisionHash} />
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

function AgentView({ snapshot }: { snapshot: AgoraSnapshot }) {
  const latest = snapshot.agent.latest;
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

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Latest decision</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--bone)]">
              {latest.selectedStrategy ?? "No strategy selected"}
            </h2>
          </div>
          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)]">
            {latest.policyProfile}
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Evaluated" value={String(latest.opportunitiesEvaluated)} />
          <Metric label="Eligible" value={String(latest.eligibleOpportunities)} />
          <Metric label="Score" value={latest.score == null ? "N/A" : latest.score.toFixed(2)} />
        </div>
        <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">Reasoning trace</h3>
          <ol className="mt-3 space-y-3">
            {latest.trace.map((line, index) => (
              <li key={`${line}-${index}`} className="flex gap-3 text-sm text-[var(--text-secondary)]">
                <span className="font-mono text-[var(--accent)]">{String(index + 1).padStart(2, "0")}</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-5">
          <h3 className="text-sm font-semibold text-[var(--text)]">Selected opportunity</h3>
          <div className="mt-3">
            <DetailRow label="Chain" value={latest.selectedChain ?? "N/A"} />
            <DetailRow label="Asset" value={latest.selectedAsset ?? "N/A"} />
            <DetailRow label="Quote" value={latest.quoteId ?? "N/A"} />
            <DetailRow label="Size" value={latest.size == null ? "N/A" : `${fmtAmount(latest.size)} USDC`} />
            <DetailRow label="Expected premium" value={latest.expectedPremium == null ? "N/A" : fmtUsd(latest.expectedPremium)} />
            <DetailRow label="Decision hash" value={truncate(latest.decisionHash)} />
          </div>
        </section>
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-5">
          <h3 className="text-sm font-semibold text-[var(--text)]">Rejections</h3>
          <div className="mt-3">
            {Object.entries(latest.rejectionCounts).map(([reason, count]) => (
              <DetailRow key={reason} label={reason.replaceAll("_", " ")} value={String(count)} />
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

export function VaultPageClient() {
  const { user } = usePrivy();
  const { address, baseAddresses, solanaAddress, solanaAddresses, isConnected } =
    useWalletSummary();
  const { wallets: b1naryWallets } = useB1naryAccount({
    autoSyncTrustedWallets: false,
  });
  const [view, setView] = useState<View>("deposit");
  const [amount, setAmount] = useState("");
  const [prepared, setPrepared] = useState<AgoraPreparedAllocation | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const baseTradingWallets = useMemo(
    () =>
      b1naryWallets
        .filter((wallet) => wallet.chain === "base" && wallet.role === "trading" && wallet.wallet_type === "smart" && wallet.verified_at)
        .map((wallet) => wallet.address as Address),
    [b1naryWallets],
  );
  const solanaTradingWallets = useMemo(
    () =>
      b1naryWallets
        .filter((wallet) => wallet.chain === "solana" && wallet.role === "trading" && wallet.verified_at)
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
  const primaryUserAddress = baseTradingWallets[0] ?? address ?? solanaTradingWallets[0] ?? solanaAddress;
  const { snapshot, loading, error } = useAgoraSnapshot(primaryUserAddress);
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

      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(window.location.href)}
        className="mt-8 inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text)]"
      >
        <Copy className="h-3.5 w-3.5" />
        Copy vault URL
      </button>
    </main>
  );
}
