import type { VaultConfig, VaultPosition } from "@/lib/vaults";
import { VAULT_STATE_COPY } from "@/lib/vaults";
import { VaultIcon } from "./VaultIcon";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function VaultCard({
  vault,
  position,
  onOpen,
}: {
  vault: VaultConfig;
  position: VaultPosition;
  onOpen: (vault: VaultConfig) => void;
}) {
  const isComingSoon = vault.availability === "coming-soon";
  const stateCopy = VAULT_STATE_COPY[position.state];
  const balanceLabel =
    vault.asset === "USDC + WETH"
      ? currency.format(vault.balanceUsd)
      : `${vault.balance.toLocaleString("en-US")} ${vault.asset}`;

  return (
    <article
      className={`group flex min-h-[520px] flex-col rounded-[28px] border bg-[var(--vault-surface)] p-5 transition-colors duration-200 sm:p-6 ${
        vault.id === "eth-csp"
          ? "border-[var(--vault-border-active)]"
          : "border-[var(--vault-border)] hover:border-[var(--vault-border-strong)]"
      }`}
    >
      <header>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-[var(--vault-text)]">
              {vault.name}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--vault-text-muted)]">
              {vault.description}
            </p>
          </div>
          {isComingSoon ? (
            <span className="rounded-full border border-[var(--vault-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--vault-text-muted)]">
              Soon
            </span>
          ) : null}
        </div>
        <p className="mt-5 font-mono text-sm font-medium text-[var(--vault-text)]">
          {balanceLabel}
        </p>
        <p className="mt-1 font-mono text-sm text-[var(--vault-text-subtle)]">
          {currency.format(vault.balanceUsd)}
        </p>
      </header>

      <div className="grid flex-1 place-items-center py-7">
        <VaultIcon icon={vault.icon} className="size-36 sm:size-40" />
      </div>

      <div className="rounded-[22px] border border-[var(--vault-border)] bg-[var(--vault-surface-soft)] p-4">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--vault-border)] pb-4 text-sm">
          <span className="text-[var(--vault-text-muted)]">Earnings</span>
          <span className="font-mono text-[var(--vault-text)]">
            {currency.format(vault.earningsUsd)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 py-4 text-sm">
          <span className="text-[var(--vault-text-muted)]">
            {vault.apy === null ? "Availability" : "Est. APY"}
          </span>
          <span className="font-mono text-base font-medium text-[var(--vault-text)]">
            {vault.apy === null ? "Coming later" : `${vault.apy.toFixed(2)}%`}
          </span>
        </div>
        <button
          type="button"
          disabled={isComingSoon}
          onClick={() => onOpen(vault)}
          className="min-h-12 w-full rounded-xl border border-[var(--vault-accent)] bg-[var(--vault-accent)] px-5 text-sm font-semibold text-[var(--vault-accent-contrast)] transition-colors duration-200 hover:bg-[var(--vault-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vault-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--vault-surface)] disabled:cursor-not-allowed disabled:border-[var(--vault-border)] disabled:bg-[var(--vault-disabled)] disabled:text-[var(--vault-text-subtle)]"
        >
          {isComingSoon ? "Coming soon" : stateCopy.action}
        </button>
      </div>
    </article>
  );
}
