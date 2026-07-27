import type { FundSummaryResponse } from "@/lib/api";
import { rawFundAmount } from "@/lib/fundVault";
import { fundValuation } from "@/lib/fundValuation";
import { type VaultPosition, VAULT_STATE_COPY } from "@/lib/vaults";
import { VaultIcon } from "./VaultIcon";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function VaultCard({
  summary,
  position,
  onOpen,
}: {
  summary: FundSummaryResponse | null;
  position: VaultPosition;
  onOpen: () => void;
}) {
  const decimals = summary?.fund.accountingAsset.decimals ?? 6;
  const total = summary ? rawFundAmount(summary.netAssets, decimals) : null;
  const valuation = summary ? fundValuation(summary) : null;
  const sharePrice = valuation
    ? rawFundAmount(valuation.navPriceAssets, decimals)
    : null;
  const entryOpen = summary?.actions.deposit.available === true && !summary.stale;
  const stateCopy = VAULT_STATE_COPY[position.state];
  const entryLabel = !summary
    ? "Loading"
    : entryOpen
      ? "Open"
      : summary.status.depositsPaused
        ? "Deposits paused"
        : "Entry unavailable";

  return (
    <article className="overflow-hidden rounded-[28px] border border-[var(--vault-border)] bg-[var(--vault-surface)] p-5 sm:p-7">
      <header className="flex items-start justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-[var(--vault-surface-soft)]">
            <VaultIcon icon="usdc" className="size-10" />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--vault-text-subtle)]">
              USDC vault
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em] sm:text-2xl">
              ETH Cash-Secured Put
            </h2>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--vault-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--vault-text-muted)]">
          {entryLabel}
        </span>
      </header>

      <div className="mt-9">
        <p className="text-xs text-[var(--vault-text-subtle)]">Your value</p>
        <p className="mt-1 font-mono text-4xl tracking-[-0.055em] sm:text-5xl">
          {currency.format(position.accountingValue)}
        </p>
        <p className="mt-2 font-mono text-xs text-[var(--vault-text-subtle)]">
          {position.shares.toLocaleString("en-US", { maximumFractionDigits: 6 })} shares
        </p>
      </div>

      <dl className="mt-8 grid grid-cols-3 gap-4 rounded-2xl bg-[var(--vault-surface-soft)] p-4">
        <Metric
          label="NAV price"
          value={sharePrice === null ? "—" : currency.format(sharePrice)}
        />
        <Metric label="Fund size" value={total === null ? "—" : currency.format(total)} />
        <Metric label="Strategy" value="ETH puts" />
      </dl>

      <div className="mt-5 flex items-center justify-between border-t border-[var(--vault-border)] pt-5">
        <div>
          <p className="text-[11px] text-[var(--vault-text-subtle)]">Position</p>
          <p className="mt-1 text-sm text-[var(--vault-text)]">{stateCopy.label}</p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="min-h-11 rounded-full bg-[var(--vault-accent)] px-6 text-sm font-semibold text-[var(--vault-accent-contrast)] transition-colors hover:bg-[var(--vault-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vault-accent)]"
        >
          {stateCopy.action}
        </button>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] leading-4 text-[var(--vault-text-subtle)]">{label}</dt>
      <dd className="mt-1 font-mono text-xs text-[var(--vault-text)] sm:text-sm">{value}</dd>
    </div>
  );
}
