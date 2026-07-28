import type { FundSummaryResponse } from "@/lib/api";
import { rawFundAmount } from "@/lib/fundVault";
import { fundValuation } from "@/lib/fundValuation";
import {
  CSP_VAULT_CARD,
  type VaultCardMetadata,
  type VaultPosition,
  vaultStateCopy,
} from "@/lib/vaults";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { VaultIcon } from "./VaultIcon";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function VaultCard({
  vault = CSP_VAULT_CARD,
  summary,
  position,
  onOpen,
}: {
  vault?: VaultCardMetadata;
  summary: FundSummaryResponse | null;
  position: VaultPosition | null;
  onOpen?: () => void;
}) {
  const comingSoon = vault.availability === "coming-soon";
  const decimals = summary?.fund.accountingAsset.decimals ?? 6;
  const total = summary ? rawFundAmount(summary.netAssets, decimals) : null;
  const valuation = summary ? fundValuation(summary) : null;
  const sharePrice = valuation
    ? rawFundAmount(valuation.navPriceAssets, decimals)
    : null;
  const entryOpen = summary?.actions.deposit.available === true && !summary.stale;
  const priceUpdating = Boolean(
    summary &&
      (summary.stale ||
        summary.nav.stale ||
        summary.actions.deposit.reasonCode === "NAV_NOT_ACTIVE"),
  );
  const stateCopy = position
    ? vaultStateCopy(position.state, vault.accountingAssetSymbol)
    : null;
  const entryLabel = comingSoon
    ? "Coming soon"
    : !summary
      ? "Loading"
      : entryOpen
        ? "Open"
        : priceUpdating
          ? "Price updating"
        : summary.status.depositsPaused
          ? "Deposits paused"
          : "Entry unavailable";
  const positionLabel = comingSoon ? "Prelaunch" : (stateCopy?.label ?? "Unavailable");
  const actionLabel = comingSoon ? "Coming soon" : (stateCopy?.action ?? "Unavailable");

  return (
    <article
      aria-labelledby={`${vault.id}-title`}
      className="flex h-full flex-col overflow-hidden rounded-[28px] border border-[var(--vault-border)] bg-[var(--vault-surface)] p-5 sm:p-7"
    >
      <header className="flex items-start justify-between gap-5">
        <div className="grid size-14 shrink-0 place-items-center rounded-full bg-[var(--vault-surface-soft)]">
          <VaultIcon icon={vault.icon} className="size-10" />
        </div>
        <span className="shrink-0 rounded-full border border-[var(--vault-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--vault-text-muted)]">
          {entryLabel}
        </span>
      </header>

      <h2
        id={`${vault.id}-title`}
        className="mt-5 text-xl font-semibold leading-tight tracking-[-0.035em] text-[var(--vault-text)] sm:text-2xl"
      >
        {vault.name}
      </h2>
      <p className="mt-2 max-w-[46ch] text-sm leading-6 text-[var(--vault-text-muted)]">
        {vault.description}
      </p>

      <div className="mt-8">
        <p className="text-xs text-[var(--vault-text-subtle)]">Your value</p>
        <p className="mt-1 font-mono text-4xl tracking-[-0.055em] sm:text-5xl">
          {position
            ? accountingValue(position.accountingValue, vault.accountingAssetSymbol)
            : "—"}
        </p>
        <p className="mt-2 font-mono text-xs text-[var(--vault-text-subtle)]">
          {position
            ? `${position.shares.toLocaleString("en-US", { maximumFractionDigits: 6 })} shares`
            : "Available after launch"}
        </p>
      </div>

      <dl className="mt-8 grid grid-cols-3 gap-4 rounded-2xl bg-[var(--vault-surface-soft)] p-4">
        <Metric
          label="NAV price"
          value={
            sharePrice === null
              ? "—"
              : accountingValue(sharePrice, vault.accountingAssetSymbol)
          }
          help="The current value of one fund share. Deposits and exits use this price only while it is current."
        />
        <Metric
          label="Fund size"
          value={
            total === null
              ? "—"
              : accountingValue(total, vault.accountingAssetSymbol)
          }
        />
        <Metric label="Strategy" value={vault.strategyLabel} />
      </dl>

      <div className="mt-5 flex items-center justify-between border-t border-[var(--vault-border)] pt-5">
        <div>
          <p className="text-[11px] text-[var(--vault-text-subtle)]">Position</p>
          <p className="mt-1 text-sm text-[var(--vault-text)]">{positionLabel}</p>
        </div>
        <button
          type="button"
          disabled={comingSoon}
          onClick={onOpen}
          className="min-h-11 rounded-full bg-[var(--vault-accent)] px-6 text-sm font-semibold text-[var(--vault-accent-contrast)] transition-colors hover:bg-[var(--vault-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vault-accent)] disabled:cursor-not-allowed disabled:bg-[var(--vault-disabled)] disabled:text-[var(--vault-text-subtle)]"
        >
          {actionLabel}
        </button>
      </div>
    </article>
  );
}

function accountingValue(value: number, symbol: string): string {
  if (symbol === "USDC") return currency.format(value);
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: 6,
  })} ${symbol}`;
}

function Metric({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help?: string;
}) {
  return (
    <div>
      <dt className="flex items-center text-[10px] leading-4 text-[var(--vault-text-subtle)]">
        <span>{label}</span>
        {help ? <InfoTooltip title={label} text={help} /> : null}
      </dt>
      <dd className="mt-1 font-mono text-xs text-[var(--vault-text)] sm:text-sm">{value}</dd>
    </div>
  );
}
