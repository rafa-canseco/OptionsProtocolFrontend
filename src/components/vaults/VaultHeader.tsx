"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

const ConnectButton = dynamic(
  () => import("@/components/ConnectButton").then((module) => module.ConnectButton),
  {
    ssr: false,
    loading: () => <div className="h-11 w-24 rounded-full bg-[var(--vault-surface-soft)]" />,
  },
);

const LINKS = [
  { id: "catalog", href: "/vaults", label: "Vaults" },
  { id: "my", href: "/vaults/my", label: "My Vaults" },
] as const;

export function VaultHeader({ active }: { active: "catalog" | "my" }) {
  return (
    <header className="border-b border-[var(--vault-border)]">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-5 sm:gap-10">
          <Link href="/vaults" className="font-mono text-lg font-bold tracking-[-0.04em] text-[var(--bone)]">
            b<span className="text-[var(--vault-accent)]">1</span>nary
            <span className="ml-2 font-sans text-sm font-medium tracking-normal text-[var(--vault-text-subtle)]">v2</span>
          </Link>
          <nav aria-label="Vault navigation" className="flex items-center gap-4 text-sm sm:gap-6">
            {LINKS.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                aria-current={active === link.id ? "page" : undefined}
                className={`border-b-2 py-3 font-medium transition-colors ${
                  active === link.id
                    ? "border-[var(--vault-accent)] text-[var(--vault-text)]"
                    : "border-transparent text-[var(--vault-text-muted)] hover:text-[var(--vault-text)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/earn/eth"
              className="hidden border-b-2 border-transparent py-3 text-[var(--vault-text-muted)] transition-colors hover:text-[var(--vault-text)] md:block"
            >
              Manual trading
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            aria-label="Network: Base Sepolia"
            className="hidden min-h-11 items-center gap-2 rounded-xl border border-[var(--vault-border)] px-3 text-xs text-[var(--vault-text-muted)] lg:flex"
          >
            <span className="size-2 rounded-full bg-[#0052FF]" />
            Base Sepolia
            <ChevronDown className="size-3.5" />
          </button>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
