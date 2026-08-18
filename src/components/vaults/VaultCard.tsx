"use client";

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
import { useAppPreferences } from "@/lib/preferences";

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
  const { locale } = useAppPreferences();
  const t = (en: string, es: string) => locale === "es" ? es : en;
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
  const localizedStateCopy = locale === "es" && position
    ? position.state === "empty"
      ? { label: "Sin posición", action: `Depositar ${vault.accountingAssetSymbol}` }
      : position.state === "invested"
        ? { label: "Invertida", action: "Gestionar posición" }
        : position.state === "pending"
          ? { label: "Retiro pendiente", action: "Ver solicitud" }
          : position.state === "partial"
            ? { label: "Procesado parcialmente", action: `Retirar ${vault.accountingAssetSymbol} disponible` }
            : { label: `${vault.accountingAssetSymbol} disponible`, action: `Retirar ${vault.accountingAssetSymbol}` }
    : stateCopy;
  const entryLabel = comingSoon
    ? t("Coming soon", "Próximamente")
    : !summary
      ? t("Loading", "Cargando")
      : entryOpen
        ? t("Open", "Disponible")
        : priceUpdating
          ? t("Price updating", "Actualizando precio")
        : summary.status.depositsPaused
          ? t("Deposits paused", "Depósitos pausados")
          : t("Entry unavailable", "Entrada no disponible");
  const positionLabel = comingSoon ? t("Prelaunch", "Prelanzamiento") : (localizedStateCopy?.label ?? t("Unavailable", "No disponible"));
  const actionLabel = comingSoon ? t("Coming soon", "Próximamente") : (localizedStateCopy?.action ?? t("Unavailable", "No disponible"));

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
        {locale === "es" ? vault.id.endsWith("-csp") ? "Entrada Estratégica" : vault.id.endsWith("-covered-call") ? "Estrategia de Ingresos" : "Ciclo Automático" : vault.name}
      </h2>
      <p className="mt-2 max-w-[46ch] text-sm leading-6 text-[var(--vault-text-muted)]">
        {locale === "es" ? vault.id.endsWith("-csp") ? "Busca comprar ETH a un precio más bajo mientras genera ingresos." : vault.id.endsWith("-covered-call") ? "Busca vender ETH a un precio más alto mientras genera ingresos." : "Alterna automáticamente entre comprar y vender." : vault.description}
      </p>

      <div className="mt-8">
        <p className="text-xs text-[var(--vault-text-subtle)]">{t("Your value", "Tu valor")}</p>
        <p className="mt-1 font-mono text-4xl tracking-[-0.055em] sm:text-5xl">
          {position
            ? accountingValue(position.accountingValue, vault.accountingAssetSymbol)
            : "—"}
        </p>
        <p className="mt-2 font-mono text-xs text-[var(--vault-text-subtle)]">
          {position
            ? `${position.shares.toLocaleString(locale === "es" ? "es-MX" : "en-US", { maximumFractionDigits: 6 })} ${t("shares", "participaciones")}`
            : t("Available after launch", "Disponible después del lanzamiento")}
        </p>
      </div>

      <dl className="mt-8 grid grid-cols-3 gap-4 rounded-2xl bg-[var(--vault-surface-soft)] p-4">
        <Metric
          label={t("NAV price", "Precio NAV")}
          value={
            sharePrice === null
              ? "—"
              : accountingValue(sharePrice, vault.accountingAssetSymbol)
          }
          help={t("The current value of one fund share. Deposits and exits use this price only while it is current.", "El valor actual de una participación. Los depósitos y retiros usan este precio mientras esté vigente.")}
        />
        <Metric
          label={t("Fund size", "Tamaño")}
          value={
            total === null
              ? "—"
              : accountingValue(total, vault.accountingAssetSymbol)
          }
        />
        <Metric label={t("Strategy", "Estrategia")} value={vault.strategyLabel} />
      </dl>

      <div className="mt-5 flex items-center justify-between border-t border-[var(--vault-border)] pt-5">
        <div>
          <p className="text-[11px] text-[var(--vault-text-subtle)]">{t("Position", "Posición")}</p>
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
