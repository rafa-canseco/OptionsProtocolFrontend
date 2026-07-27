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
  CSP_VAULT_CARD,
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

const ConnectButton = dynamic(
  () => import("@/components/ConnectButton").then((module) => module.ConnectButton),
  { ssr: false },
);

export function VaultsPage({ view = "catalog" }: { view?: "catalog" | "my" }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catalogAssetSlug, setCatalogAssetSlug] = useState("eth");
  const { address } = useWallet();
  const balances = useBalances(address);
  const fund = useFundVault(address);
  const position = mapFundPosition(fund.position, fund.summary);
  const isMyView = view === "my";
  const catalogAsset = ASSETS[catalogAssetSlug] ?? ASSETS.eth;
  const catalogCsp = vaultCardMetadata("csp", catalogAsset);
  const catalogCoveredCall = vaultCardMetadata("covered-call", catalogAsset);
  const catalogHasLiveFund = catalogAsset.slug === "eth";
  const manualTradingAsset = isMyView ? "eth" : catalogAsset.slug;

  return (
    <div className="vault-experience min-h-dvh bg-[var(--vault-bg)] text-[var(--vault-text)]">
      <VaultHeader
        view={view}
        address={address}
        balances={{
          usdc: balances.usd,
          eth: balances.eth,
          shares: position.shares,
          shareValue: position.accountingValue,
          shareSymbol: fund.summary?.fund.shareToken.symbol ?? "b1CSP-V2",
          loading: balances.loading,
          sharesLoading: fund.loading && !fund.position,
        }}
      />
      <main className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mb-8 sm:mb-10">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--vault-accent)]">
              {isMyView
                ? "Base Sepolia · Automated CSP"
                : "Base Sepolia · Automated strategies"}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              {isMyView ? "My Vaults" : "Vaults"}
            </h1>
            <p className="mt-3 max-w-xl text-base text-[var(--vault-text-muted)]">
              {isMyView
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
          className={isMyView ? "max-w-[640px]" : "grid gap-5 lg:grid-cols-2"}
        >
          <VaultCard
            vault={isMyView ? CSP_VAULT_CARD : catalogCsp}
            summary={isMyView || catalogHasLiveFund ? fund.summary : null}
            position={isMyView || catalogHasLiveFund ? position : null}
            onOpen={
              isMyView || catalogHasLiveFund
                ? () => setDialogOpen(true)
                : undefined
            }
          />
          {!isMyView ? (
            <VaultCard
              vault={catalogCoveredCall}
              summary={null}
              position={null}
            />
          ) : null}
          {isMyView ? <PositionDetails position={position} /> : null}
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--vault-border)] pt-6 text-xs text-[var(--vault-text-subtle)]">
          <span>v2 · Base Sepolia</span>
          <Link href={`/earn/${manualTradingAsset}`} className="min-h-11 py-3 hover:text-[var(--vault-text)]">
            Manual trading <span className="text-[var(--vault-text-muted)]">Open classic →</span>
          </Link>
        </footer>
      </main>

      <VaultDialog
        summary={fund.summary}
        position={fund.position}
        config={fund.config}
        loadError={fund.error ?? fund.trustError}
        smartUsdcRaw={balances.usdRaw}
        onRefetch={fund.refetch}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
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
    shares: number;
    shareValue: number;
    shareSymbol: string;
    loading: boolean;
    sharesLoading: boolean;
  };
};

function VaultHeader({ view, address, balances }: VaultHeaderProps) {
  return (
    <header className="border-b border-[var(--vault-border)]">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/vaults" className="font-mono text-lg font-bold tracking-[-0.04em] text-[var(--bone)]">
            b<span className="text-[var(--vault-accent)]">1</span>nary
            <span className="ml-2 font-sans text-sm font-medium tracking-normal text-[var(--vault-text-subtle)]">v2</span>
          </Link>
          <nav aria-label="Vault navigation" className="hidden gap-6 text-sm sm:flex">
            <Link href="/vaults" aria-current={view === "catalog" ? "page" : undefined}>Vaults</Link>
            <Link href="/vaults/my" aria-current={view === "my" ? "page" : undefined}>My Vaults</Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {address ? (
            <VaultBalances
              address={address}
              usdc={balances.usdc}
              eth={balances.eth}
              shares={balances.shares}
              shareValue={balances.shareValue}
              shareSymbol={balances.shareSymbol}
              loading={balances.loading}
              sharesLoading={balances.sharesLoading}
            />
          ) : null}
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
  shares,
  shareValue,
  shareSymbol,
  loading,
  sharesLoading,
}: {
  address: string;
  usdc: number;
  eth: number;
  shares: number;
  shareValue: number;
  shareSymbol: string;
  loading: boolean;
  sharesLoading: boolean;
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
          <VaultBalanceRow icon="/eth.png" label="ETH gas" value={loading ? "—" : formatBalance(eth, 5)} />
          <VaultShareBalance
            symbol={shareSymbol}
            shares={shares}
            shareValue={shareValue}
            loading={sharesLoading}
          />
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
  loading,
}: {
  symbol: string;
  shares: number;
  shareValue: number;
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
        <span>{loading ? "—" : `≈ ${formatBalance(shareValue, 2)} USDC`}</span>
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

function PositionDetails({ position }: { position: ReturnType<typeof mapFundPosition> }) {
  return (
    <section aria-label="Redemption status" className="mt-5 grid gap-4 sm:grid-cols-2">
      <PositionMetric label="Pending redemption" value={`~$${position.pendingValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}`} detail={`${position.pendingShares.toLocaleString("en-US", { maximumFractionDigits: 6 })} shares`} />
      <PositionMetric label="Claimable now" value={`$${position.claimableAssets.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} detail={`${position.claimableShares.toLocaleString("en-US", { maximumFractionDigits: 6 })} processed shares`} />
    </section>
  );
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
