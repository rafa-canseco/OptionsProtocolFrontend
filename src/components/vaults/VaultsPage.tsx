"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useBalances } from "@/hooks/useBalances";
import { useFundVault } from "@/hooks/useFundVault";
import { useWallet } from "@/hooks/useWallet";
import { ASSETS } from "@/lib/assets";
import {
  BASE_SEPOLIA_COVERED_CALL_FUND,
  BASE_SEPOLIA_CSP_FUND,
  BASE_SEPOLIA_META_WHEEL_FUND,
  BASE_SEPOLIA_META_WHEEL_HANDOFF,
  isMetaWheelFrontendReady,
} from "@/lib/fundDeployment";
import {
  COVERED_CALL_VAULT_CARD,
  CSP_VAULT_CARD,
  META_WHEEL_VAULT_CARD,
  mapFundPosition,
  vaultCardMetadata,
} from "@/lib/vaults";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { VaultAssetSelector } from "./VaultAssetSelector";
import { VaultCard } from "./VaultCard";
import { VaultDialog } from "./VaultDialog";
import { AppPreferenceControls } from "@/components/AppPreferenceControls";
import { useAppPreferences } from "@/lib/preferences";

const ConnectButton = dynamic(
  () => import("@/components/ConnectButton").then((module) => module.ConnectButton),
  { ssr: false },
);

export function VaultsPage({ view = "catalog" }: { view?: "catalog" | "my" }) {
  const { locale } = useAppPreferences();
  const [dialogVault, setDialogVault] = useState<
    "csp" | "covered-call" | "meta-wheel" | null
  >(null);
  const [catalogAssetSlug, setCatalogAssetSlug] = useState("eth");
  const { address } = useWallet();
  const balances = useBalances(address);
  const cspFund = useFundVault(address, BASE_SEPOLIA_CSP_FUND);
  const coveredCallFund = useFundVault(
    address,
    BASE_SEPOLIA_COVERED_CALL_FUND,
  );
  const metaWheelFund = useFundVault(address, BASE_SEPOLIA_META_WHEEL_FUND);
  const cspPosition = mapFundPosition(cspFund.position, cspFund.summary);
  const coveredCallPosition = mapFundPosition(
    coveredCallFund.position,
    coveredCallFund.summary,
  );
  const metaWheelPosition = mapFundPosition(
    metaWheelFund.position,
    metaWheelFund.summary,
  );
  const metaWheelFrontendReady = isMetaWheelFrontendReady(
    BASE_SEPOLIA_META_WHEEL_FUND,
    BASE_SEPOLIA_META_WHEEL_HANDOFF,
  );
  const metaWheelCard = metaWheelFrontendReady
    ? { ...META_WHEEL_VAULT_CARD, availability: "live" as const }
    : META_WHEEL_VAULT_CARD;
  const isMyView = view === "my";
  const catalogAsset = ASSETS[catalogAssetSlug] ?? ASSETS.eth;
  const catalogCsp = vaultCardMetadata("csp", catalogAsset);
  const catalogCoveredCall = vaultCardMetadata("covered-call", catalogAsset);
  const catalogHasLiveFund = catalogAsset.slug === "eth";
  const manualTradingAsset = isMyView ? "eth" : catalogAsset.slug;
  const hasCoveredCallPosition = coveredCallPosition.state !== "empty";

  return (
    <div className="vault-experience min-h-dvh bg-[var(--vault-bg)] text-[var(--vault-text)]">
      <VaultHeader
        view={view}
        address={address}
        balances={{
          usdc: balances.usd,
          eth: balances.eth,
          weth: balances.weth,
          loading: balances.loading,
          shareBalances: [
            {
              symbol: cspFund.summary?.fund.shareToken.symbol ?? "b1CSP-V2",
              shares: cspPosition.shares,
              shareValue: cspPosition.accountingValue,
              assetSymbol: "USDC",
              loading: cspFund.loading && !cspFund.position,
            },
            {
              symbol:
                coveredCallFund.summary?.fund.shareToken.symbol ?? "b1CALL-V2",
              shares: coveredCallPosition.shares,
              shareValue: coveredCallPosition.accountingValue,
              assetSymbol: "WETH",
              loading: coveredCallFund.loading && !coveredCallFund.position,
            },
            {
              symbol:
                metaWheelFund.summary?.fund.shareToken.symbol ?? "b1WHEEL-V2",
              shares: metaWheelPosition.shares,
              shareValue: metaWheelPosition.accountingValue,
              assetSymbol: "USDC",
              loading: metaWheelFund.loading && !metaWheelFund.position,
            },
          ],
        }}
      />
      <main className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mb-8 sm:mb-10">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--vault-accent)]">
              {locale === "es"
                ? isMyView ? "Base Sepolia · CSP automatizado" : "Base Sepolia · Estrategias automatizadas"
                : isMyView ? "Base Sepolia · Automated CSP" : "Base Sepolia · Automated strategies"}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              {locale === "es" ? (isMyView ? "Mis bóvedas" : "Bóvedas") : (isMyView ? "My Vaults" : "Vaults")}
            </h1>
            <p className="mt-3 max-w-xl text-base text-[var(--vault-text-muted)]">
              {locale === "es"
                ? isMyView
                  ? "Tu posición, estado de retiro y siguiente acción."
                  : "Estrategias automatizadas de ETH. Elige un activo y deja que la estrategia gestione cada ciclo."
                : isMyView
                  ? "Your fund position, redemption status, and next action."
                  : "Automated ETH option strategies. Choose a vault asset and let the fund manage each cycle."}
            </p>
          </div>
        </div>

        {!isMyView ? (
          <div
            aria-label="Vault catalog asset selector"
            className="mb-5 flex justify-start"
          >
            <VaultAssetSelector
              currentSlug={catalogAsset.slug}
              onChange={setCatalogAssetSlug}
            />
          </div>
        ) : null}

        <section
          aria-label={isMyView ? "Your vault positions" : "Available vaults"}
          className={isMyView ? "max-w-[640px]" : "grid gap-5 lg:grid-cols-2 xl:grid-cols-3"}
        >
          <VaultCard
            vault={isMyView ? CSP_VAULT_CARD : catalogCsp}
            summary={
              isMyView || catalogHasLiveFund ? cspFund.summary : null
            }
            position={
              isMyView || catalogHasLiveFund ? cspPosition : null
            }
            onOpen={
              isMyView || catalogHasLiveFund
                ? () => setDialogVault("csp")
                : undefined
            }
          />
          {!isMyView || hasCoveredCallPosition ? (
            <VaultCard
              vault={
                isMyView ? COVERED_CALL_VAULT_CARD : catalogCoveredCall
              }
              summary={
                isMyView || catalogHasLiveFund
                  ? coveredCallFund.summary
                  : null
              }
              position={
                isMyView || catalogHasLiveFund
                  ? coveredCallPosition
                  : null
              }
              onOpen={
                isMyView || catalogHasLiveFund
                  ? () => setDialogVault("covered-call")
                  : undefined
              }
            />
          ) : null}
          {!isMyView && catalogAsset.slug === "eth" ? (
            <VaultCard
              vault={metaWheelCard}
              summary={metaWheelFund.summary}
              position={metaWheelPosition}
              onOpen={
                metaWheelFrontendReady
                  ? () => setDialogVault("meta-wheel")
                  : undefined
              }
            />
          ) : null}
          {isMyView ? (
            <PositionDetails position={cspPosition} assetSymbol="USDC" />
          ) : null}
          {isMyView && hasCoveredCallPosition ? (
            <PositionDetails
              position={coveredCallPosition}
              assetSymbol="WETH"
            />
          ) : null}
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--vault-border)] pt-6 text-xs text-[var(--vault-text-subtle)]">
          <span>v2 · Base Sepolia</span>
          <Link href={`/earn/${manualTradingAsset}`} className="min-h-11 py-3 hover:text-[var(--vault-text)]">
            {locale === "es" ? "Operación manual" : "Manual trading"} <span className="text-[var(--vault-text-muted)]">{locale === "es" ? "Abrir clásico →" : "Open classic →"}</span>
          </Link>
        </footer>
      </main>

      <VaultDialog
        vault={CSP_VAULT_CARD}
        deployment={BASE_SEPOLIA_CSP_FUND}
        summary={cspFund.summary}
        position={cspFund.position}
        config={cspFund.config}
        loadError={cspFund.error ?? cspFund.trustError}
        smartAssetRaw={balances.usdRaw}
        onRefetch={cspFund.refetch}
        open={dialogVault === "csp"}
        onOpenChange={(open) => setDialogVault(open ? "csp" : null)}
      />
      <VaultDialog
        vault={COVERED_CALL_VAULT_CARD}
        deployment={BASE_SEPOLIA_COVERED_CALL_FUND}
        summary={coveredCallFund.summary}
        position={coveredCallFund.position}
        config={coveredCallFund.config}
        loadError={coveredCallFund.error ?? coveredCallFund.trustError}
        smartAssetRaw={balances.wethRaw}
        onRefetch={coveredCallFund.refetch}
        open={dialogVault === "covered-call"}
        onOpenChange={(open) => setDialogVault(open ? "covered-call" : null)}
      />
      <VaultDialog
        vault={metaWheelCard}
        deployment={BASE_SEPOLIA_META_WHEEL_FUND}
        summary={metaWheelFund.summary}
        position={metaWheelFund.position}
        config={metaWheelFund.config}
        loadError={metaWheelFund.error ?? metaWheelFund.trustError}
        smartAssetRaw={balances.usdRaw}
        onRefetch={metaWheelFund.refetch}
        open={dialogVault === "meta-wheel"}
        onOpenChange={(open) => setDialogVault(open ? "meta-wheel" : null)}
      />
    </div>
  );
}

type VaultHeaderProps = {
  view: "catalog" | "my";
  address?: string;
  balances: {
    usdc: number;
    eth: number;
    weth: number;
    loading: boolean;
    shareBalances: ShareBalance[];
  };
};

type ShareBalance = {
  symbol: string;
  shares: number;
  shareValue: number;
  assetSymbol: "USDC" | "WETH";
  loading: boolean;
};

function VaultHeader({ view, address, balances }: VaultHeaderProps) {
  const { locale } = useAppPreferences();
  return (
    <header className="border-b border-[var(--vault-border)]">
      <div className="mx-auto flex max-w-[1180px] items-start justify-between gap-2 px-3 py-3 sm:px-6 sm:py-4 lg:items-center lg:px-8">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-8">
          <Link href="/vaults" className="font-mono text-lg font-bold tracking-[-0.04em] text-[var(--bone)]">
            b<span className="text-[var(--vault-accent)]">1</span>nary
            <span className="ml-2 hidden font-sans text-sm font-medium tracking-normal text-[var(--vault-text-subtle)] sm:inline">v2</span>
          </Link>
          <nav aria-label={locale === "es" ? "Navegación de bóvedas" : "Vault navigation"} className="order-3 flex w-full gap-4 pt-1 text-xs sm:text-sm lg:order-none lg:w-auto lg:gap-6 lg:pt-0">
            <Link href="/vaults" aria-current={view === "catalog" ? "page" : undefined}>{locale === "es" ? "Bóvedas" : "Vaults"}</Link>
            <Link href="/vaults/my" aria-current={view === "my" ? "page" : undefined}>{locale === "es" ? "Mis bóvedas" : "My Vaults"}</Link>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {address ? (
            <VaultBalances
              address={address}
              usdc={balances.usdc}
              eth={balances.eth}
              weth={balances.weth}
              loading={balances.loading}
              shareBalances={balances.shareBalances}
            />
          ) : null}
          <AppPreferenceControls vault />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}

function VaultBalances({
  address,
  usdc,
  eth,
  weth,
  loading,
  shareBalances,
}: {
  address: string;
  usdc: number;
  eth: number;
  weth: number;
  loading: boolean;
  shareBalances: ShareBalance[];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Smart wallet balances"
          className="hidden min-h-11 items-center gap-2 rounded-full border border-[var(--vault-border)] bg-[var(--vault-surface)] px-3 text-sm transition-colors hover:border-[var(--vault-text-subtle)] sm:flex"
        >
          <Image src="/usdc.svg" alt="" aria-hidden="true" width={16} height={16} className="size-4 rounded-full" />
          <span className="font-mono text-[var(--vault-text)]">
            {loading ? "—" : `${formatBalance(usdc, 2)} USDC`}
          </span>
          <ChevronDown className="size-3.5 text-[var(--vault-text-subtle)]" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 border-[var(--vault-border)] bg-[var(--vault-surface)] p-4 text-[var(--vault-text)]"
      >
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--vault-text-subtle)]">
          Vault wallet
        </p>
        <p className="mt-1 font-mono text-xs text-[var(--vault-text-muted)]">
          {truncateAddress(address)}
        </p>
        <div className="mt-4 space-y-3 border-t border-[var(--vault-border)] pt-4">
          <VaultBalanceRow icon="/usdc.svg" label="USDC" value={loading ? "—" : formatBalance(usdc, 2)} />
          <VaultBalanceRow icon="/weth.png" label="WETH" value={loading ? "—" : formatBalance(weth, 6)} />
          <VaultBalanceRow icon="/eth.png" label="ETH gas" value={loading ? "—" : formatBalance(eth, 5)} />
          {shareBalances.map((balance) => (
            <VaultShareBalance key={balance.symbol} {...balance} />
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-[var(--vault-text-subtle)]">
          Base Sepolia · Used for vault deposits and redemptions.
        </p>
      </PopoverContent>
    </Popover>
  );
}

function VaultShareBalance({
  symbol,
  shares,
  shareValue,
  assetSymbol,
  loading,
}: {
  symbol: string;
  shares: number;
  shareValue: number;
  assetSymbol: "USDC" | "WETH";
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--vault-border)] bg-[var(--vault-surface-soft)] px-3 py-2.5">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="flex items-center gap-2 text-[var(--vault-text-muted)]">
          <span
            aria-hidden="true"
            className="grid size-4 place-items-center rounded-full border border-[var(--vault-accent)] font-mono text-[8px] font-bold text-[var(--vault-accent)]"
          >
            1
          </span>
          Fund shares
        </span>
        <span className="font-mono">
          {loading ? "—" : formatBalance(shares, 4)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-4 font-mono text-[10px] text-[var(--vault-text-subtle)]">
        <span>{symbol}</span>
        <span>
          {loading
            ? "—"
            : `≈ ${formatBalance(
                shareValue,
                assetSymbol === "USDC" ? 2 : 6,
              )} ${assetSymbol}`}
        </span>
      </div>
    </div>
  );
}

function VaultBalanceRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="flex items-center gap-2 text-[var(--vault-text-muted)]">
        <Image src={icon} alt="" aria-hidden="true" width={16} height={16} className="size-4 rounded-full" />
        {label}
      </span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function formatBalance(value: number, maximumFractionDigits: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: Math.min(2, maximumFractionDigits),
    maximumFractionDigits,
  });
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function PositionDetails({
  position,
  assetSymbol,
}: {
  position: ReturnType<typeof mapFundPosition>;
  assetSymbol: "USDC" | "WETH";
}) {
  return (
    <section aria-label="Redemption status" className="mt-5 grid gap-4 sm:grid-cols-2">
      <PositionMetric label="Pending redemption" value={`~${formatAccountingValue(position.pendingValue, assetSymbol)}`} detail={`${position.pendingShares.toLocaleString("en-US", { maximumFractionDigits: 6 })} shares`} />
      <PositionMetric label="Claimable now" value={formatAccountingValue(position.claimableAssets, assetSymbol)} detail={`${position.claimableShares.toLocaleString("en-US", { maximumFractionDigits: 6 })} processed shares`} />
    </section>
  );
}

function formatAccountingValue(
  value: number,
  assetSymbol: "USDC" | "WETH",
): string {
  if (assetSymbol === "USDC") {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: 6,
  })} WETH`;
}

function PositionMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-[var(--vault-border)] bg-[var(--vault-surface)] p-5">
      <p className="text-sm text-[var(--vault-text-muted)]">{label}</p>
      <p className="mt-2 font-mono text-2xl">{value}</p>
      <p className="mt-1 font-mono text-xs text-[var(--vault-text-subtle)]">{detail}</p>
    </div>
  );
}
