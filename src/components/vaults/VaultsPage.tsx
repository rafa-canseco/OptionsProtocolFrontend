"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { EMPTY_VAULT_POSITION, VAULTS, type VaultConfig } from "@/lib/vaults";
import { VaultCard } from "./VaultCard";
import { VaultDialog } from "./VaultDialog";

const ConnectButton = dynamic(
  () => import("@/components/ConnectButton").then((module) => module.ConnectButton),
  {
    ssr: false,
    loading: () => <div className="h-11 w-24 rounded-full bg-[var(--vault-surface-soft)]" />,
  },
);

export function VaultsPage() {
  const [selectedVault, setSelectedVault] = useState<VaultConfig | null>(null);

  return (
    <div className="vault-experience min-h-dvh bg-[var(--vault-bg)] text-[var(--vault-text)]">
      <header className="border-b border-[var(--vault-border)]">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6 sm:gap-10">
            <Link href="/vaults" className="font-mono text-lg font-bold tracking-[-0.04em] text-[var(--bone)]">
              b<span className="text-[var(--vault-accent)]">1</span>nary
              <span className="ml-2 font-sans text-sm font-medium tracking-normal text-[var(--vault-text-subtle)]">v2</span>
            </Link>
            <nav aria-label="Primary" className="hidden items-center gap-6 text-sm sm:flex">
              <Link href="/vaults" aria-current="page" className="border-b-2 border-[var(--vault-accent)] py-3 font-medium text-[var(--vault-text)]">
                Vaults
              </Link>
              <Link href="/earn" className="py-3 text-[var(--vault-text-muted)] transition-colors hover:text-[var(--vault-text)]">
                Manual trading
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              aria-label="Network: Base Sepolia"
              className="hidden min-h-11 items-center gap-2 rounded-xl border border-[var(--vault-border)] px-3 text-xs text-[var(--vault-text-muted)] sm:flex"
            >
              <span className="size-2 rounded-full bg-[#0052FF]" />
              Base Sepolia
              <ChevronDown className="size-3.5" />
            </button>
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mb-8 sm:mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--vault-accent)]">Base · Automated strategies</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Vaults</h1>
          <p className="mt-3 max-w-xl text-base text-[var(--vault-text-muted)]">
            Automated options strategies. Choose an asset, deposit, and let the vault handle each cycle.
          </p>
        </div>

        <section aria-label="Available vaults" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {VAULTS.map((vault) => (
            <VaultCard
              key={vault.id}
              vault={vault}
              position={EMPTY_VAULT_POSITION}
              onOpen={setSelectedVault}
            />
          ))}
        </section>

        <div className="mt-10 flex items-center justify-between border-t border-[var(--vault-border)] pt-6 text-xs text-[var(--vault-text-subtle)]">
          <span>v2 · Base Sepolia</span>
          <Link href="/earn" className="min-h-11 py-3 transition-colors hover:text-[var(--vault-text)]">
            Looking for manual trading? <span className="text-[var(--vault-text-muted)]">Open classic →</span>
          </Link>
        </div>
      </main>

      <VaultDialog
        vault={selectedVault}
        open={selectedVault !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedVault(null);
        }}
      />
    </div>
  );
}
