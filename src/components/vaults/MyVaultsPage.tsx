"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useBalances } from "@/hooks/useBalances";
import { useCspVault } from "@/hooks/useCspVault";
import { useWallet } from "@/hooks/useWallet";
import {
  getCspWithdrawPlan,
  hasCspPosition,
  mapCspPosition,
  mergeCspVaultConfig,
} from "@/lib/cspVault";
import { VAULTS, VAULT_STATE_COPY } from "@/lib/vaults";
import { VaultDialog } from "./VaultDialog";
import { VaultHeader } from "./VaultHeader";
import { VaultIcon } from "./VaultIcon";

const amount = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

const usdc = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function MyVaultsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { address } = useWallet();
  const balances = useBalances(address);
  const csp = useCspVault(address);
  const baseVault = VAULTS.find((vault) => vault.id === "eth-csp")!;
  const depositDecimals = csp.vault?.assets.deposit.decimals ?? 6;
  const assignedDecimals = csp.vault?.assets.assigned.decimals ?? 18;
  const position = mapCspPosition(csp.user, depositDecimals, assignedDecimals);
  const vault = mergeCspVaultConfig(
    baseVault,
    csp.vault,
    csp.user,
    address ? balances.usd : null,
  );
  const hasPosition = hasCspPosition(csp.user);
  const action = getCspWithdrawPlan(csp.user);
  const stale = Boolean(csp.vault?.stale || csp.user?.stale);

  return (
    <div className="vault-experience min-h-dvh bg-[var(--vault-bg)] text-[var(--vault-text)]">
      <VaultHeader active="my" />

      <main className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="flex flex-col justify-between gap-5 border-b border-[var(--vault-border)] pb-8 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--vault-accent)]">
              Smart wallet positions
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              My Vaults
            </h1>
            <p className="mt-3 max-w-xl text-base text-[var(--vault-text-muted)]">
              What is active, what is waiting, and what you can do next.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void csp.refetch()}
            disabled={csp.loading}
            className="flex min-h-11 w-fit items-center gap-2 rounded-xl border border-[var(--vault-border)] px-4 text-sm text-[var(--vault-text-muted)] transition-colors hover:border-[var(--vault-border-strong)] hover:text-[var(--vault-text)] disabled:cursor-wait disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${csp.loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <section aria-label="Vault positions" className="mt-6">
          {csp.loading && !csp.user ? (
            <PositionSkeleton />
          ) : csp.error ? (
            <StatePanel
              title="Position unavailable"
              detail={csp.error}
              actionLabel="Try again"
              onAction={() => void csp.refetch()}
            />
          ) : !address || !hasPosition ? (
            <EmptyState connected={Boolean(address)} />
          ) : (
            <article className="overflow-hidden rounded-[24px] border border-[var(--vault-border-active)] bg-[var(--vault-surface)] shadow-[0_20px_70px_rgb(0_0_0_/_0.22)]">
              <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.1fr_1.6fr_auto] lg:items-center lg:gap-8">
                <div className="flex items-center gap-4">
                  <VaultIcon icon={vault.icon} className="size-16 shrink-0 sm:size-20" />
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--vault-text-subtle)]">
                      ETH strategy · USDC
                    </p>
                    <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">
                      {vault.name}
                    </h2>
                    <span className="mt-2 inline-flex rounded-full border border-[var(--vault-border-strong)] px-2.5 py-1 text-xs text-[var(--vault-text-muted)]">
                      {VAULT_STATE_COPY[position.state].label}
                    </span>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
                  <Metric label="Active assets" value={`${usdc.format(position.activeUsd)} USDC`} prominent />
                  <Metric label="Shares" value={amount.format(position.activeShares)} secondary />
                  {position.pendingUsd > 0 ? (
                    <Metric label="Pending deposit" value={`${usdc.format(position.pendingUsd)} USDC`} />
                  ) : null}
                  {position.pendingWithdrawalShares > 0 ? (
                    <Metric label="Pending withdrawal" value={`${amount.format(position.pendingWithdrawalShares)} shares`} secondary />
                  ) : null}
                  {position.claimableUsdc > 0 ? (
                    <Metric label="Claimable" value={`${usdc.format(position.claimableUsdc)} USDC`} />
                  ) : null}
                  {position.claimableWeth > 0 ? (
                    <Metric label="Claimable" value={`${amount.format(position.claimableWeth)} WETH`} />
                  ) : null}
                </dl>

                <button
                  type="button"
                  disabled={stale}
                  onClick={() => setDialogOpen(true)}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--vault-accent)] bg-[var(--vault-accent)] px-5 text-sm font-semibold text-[var(--vault-accent-contrast)] transition-colors hover:bg-[var(--vault-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vault-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--vault-surface)] disabled:cursor-not-allowed disabled:border-[var(--vault-border)] disabled:bg-[var(--vault-disabled)] disabled:text-[var(--vault-text-subtle)]"
                >
                  {action.label}
                  <ArrowRight className="size-4" />
                </button>
              </div>

              {stale ? (
                <div role="status" className="border-t border-amber-300/20 bg-amber-300/[0.06] px-5 py-3 text-xs text-amber-100/80 sm:px-7">
                  Data may be out of date. Refresh to enable actions.
                </div>
              ) : null}
            </article>
          )}
        </section>
      </main>

      <VaultDialog
        vault={vault}
        position={position}
        cspVault={csp.vault}
        cspUser={csp.user}
        cspLoading={csp.loading}
        cspError={csp.error}
        smartUsdcRaw={balances.usdRaw}
        onCspRefetch={csp.refetch}
        initialAction={action.mode}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  prominent = false,
  secondary = false,
}: {
  label: string;
  value: string;
  prominent?: boolean;
  secondary?: boolean;
}) {
  return (
    <div className={prominent ? "col-span-2 sm:col-span-1" : ""}>
      <dt className="text-xs text-[var(--vault-text-subtle)]">{label}</dt>
      <dd className={`mt-1 font-mono ${prominent ? "text-lg text-[var(--vault-text)]" : secondary ? "text-sm text-[var(--vault-text-muted)]" : "text-sm text-[var(--vault-text)]"}`}>
        {value}
      </dd>
    </div>
  );
}

function PositionSkeleton() {
  return (
    <div aria-label="Loading vault positions" className="grid min-h-[180px] animate-pulse gap-6 rounded-[24px] border border-[var(--vault-border)] bg-[var(--vault-surface)] p-5 sm:p-7 lg:grid-cols-[1.1fr_1.6fr_auto] lg:items-center">
      <div className="flex items-center gap-4">
        <div className="size-16 rounded-full bg-[var(--vault-surface-soft)]" />
        <div className="space-y-3"><div className="h-3 w-24 rounded bg-[var(--vault-surface-soft)]" /><div className="h-6 w-36 rounded bg-[var(--vault-surface-soft)]" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4"><div className="h-12 rounded bg-[var(--vault-surface-soft)]" /><div className="h-12 rounded bg-[var(--vault-surface-soft)]" /></div>
      <div className="h-12 w-full rounded-xl bg-[var(--vault-surface-soft)] lg:w-36" />
    </div>
  );
}

function EmptyState({ connected }: { connected: boolean }) {
  return (
    <div className="grid min-h-[280px] place-items-center rounded-[24px] border border-dashed border-[var(--vault-border-strong)] bg-[var(--vault-surface)] px-6 py-12 text-center">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--vault-accent)]">No positions yet</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
          {connected ? "Your capital is ready for a vault." : "Connect your smart wallet to view positions."}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--vault-text-muted)]">
          Browse the vault catalog to deposit USDC into the active ETH strategy.
        </p>
        <Link href="/vaults" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--vault-accent)] px-5 text-sm font-semibold text-[var(--vault-accent-contrast)]">
          Explore vaults <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function StatePanel({ title, detail, actionLabel, onAction }: { title: string; detail: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="flex min-h-[180px] flex-col justify-between gap-6 rounded-[24px] border border-[var(--vault-border)] bg-[var(--vault-surface)] p-6 sm:flex-row sm:items-center">
      <div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 max-w-xl text-sm text-[var(--vault-text-muted)]">{detail}</p></div>
      <button type="button" onClick={onAction} className="min-h-11 rounded-xl border border-[var(--vault-border-strong)] px-4 text-sm text-[var(--vault-text)]">{actionLabel}</button>
    </div>
  );
}
