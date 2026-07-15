"use client";

import { useState } from "react";
import Link from "next/link";
import { EMPTY_VAULT_POSITION, VAULTS, type VaultConfig } from "@/lib/vaults";
import { mergeCspVaultConfig, mapCspPosition } from "@/lib/cspVault";
import { useBalances } from "@/hooks/useBalances";
import { useCspVault } from "@/hooks/useCspVault";
import { useWallet } from "@/hooks/useWallet";
import { VaultCard } from "./VaultCard";
import { VaultDialog } from "./VaultDialog";
import { VaultHeader } from "./VaultHeader";

export function VaultsPage() {
  const [selectedVaultId, setSelectedVaultId] = useState<VaultConfig["id"] | null>(null);
  const { address } = useWallet();
  const balances = useBalances(address);
  const csp = useCspVault(address);
  const depositDecimals = csp.vault?.assets.deposit.decimals ?? 6;
  const assignedDecimals = csp.vault?.assets.assigned.decimals ?? 18;
  const cspPosition = mapCspPosition(csp.user, depositDecimals, assignedDecimals);
  const vaults = VAULTS.map((vault) =>
    vault.id === "eth-csp"
      ? mergeCspVaultConfig(vault, csp.vault, csp.user, address ? balances.usd : null)
      : vault,
  );
  const selectedVault = vaults.find((vault) => vault.id === selectedVaultId) ?? null;

  return (
    <div className="vault-experience min-h-dvh bg-[var(--vault-bg)] text-[var(--vault-text)]">
      <VaultHeader active="catalog" />

      <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mb-8 sm:mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--vault-accent)]">Base · Automated strategies</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Vaults</h1>
          <p className="mt-3 max-w-xl text-base text-[var(--vault-text-muted)]">
            Automated options strategies. Choose an asset, deposit, and let the vault handle each cycle.
          </p>
        </div>

        <section aria-label="Available vaults" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {vaults.map((vault) => (
            <VaultCard
              key={vault.id}
              vault={vault}
              position={vault.id === "eth-csp" ? cspPosition : EMPTY_VAULT_POSITION}
              onOpen={(nextVault) => setSelectedVaultId(nextVault.id)}
            />
          ))}
        </section>

        <div className="mt-10 flex items-center justify-between border-t border-[var(--vault-border)] pt-6 text-xs text-[var(--vault-text-subtle)]">
          <span>v2 · Base Sepolia</span>
          <Link href="/earn/eth" className="min-h-11 py-3 transition-colors hover:text-[var(--vault-text)]">
            Looking for manual trading? <span className="text-[var(--vault-text-muted)]">Open classic →</span>
          </Link>
        </div>
      </main>

      <VaultDialog
        vault={selectedVault}
        position={selectedVault?.id === "eth-csp" ? cspPosition : EMPTY_VAULT_POSITION}
        cspVault={csp.vault}
        cspUser={csp.user}
        cspLoading={csp.loading}
        cspError={csp.error}
        smartUsdcRaw={balances.usdRaw}
        onCspRefetch={csp.refetch}
        open={selectedVault !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedVaultId(null);
        }}
      />
    </div>
  );
}
