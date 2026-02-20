"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { useAutoFaucet } from "@/hooks/useAutoFaucet";
import { ConnectButton } from "./ConnectButton";

const LINKS = [
  { href: "/earn", label: "Earn" },
  { href: "/positions", label: "My earnings" },
];

export function NavBar() {
  const pathname = usePathname();
  const { address, walletClient, isConnected } = useWallet();
  const { usdFormatted, ethFormatted, loading: balLoading, refetch } = useBalances(address);
  const { minting, showNotification } = useAutoFaucet(address, walletClient, refetch);

  return (
    <>
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold tracking-tight text-[var(--text)]">
            loot
          </Link>
          <nav className="flex gap-4 text-sm">
            {LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`transition-colors ${
                  pathname === href
                    ? "text-[var(--text)] font-medium"
                    : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {isConnected && !balLoading && (
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
              <span>{usdFormatted} USD</span>
              <span className="opacity-40">·</span>
              <span>{ethFormatted} ETH</span>
            </div>
          )}
          {minting && (
            <span className="text-xs text-[var(--accent)] animate-pulse">Minting tokens...</span>
          )}
          <ConnectButton />
        </div>
      </header>

      {showNotification && (
        <div className="mx-6 mt-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-4 py-2.5 text-sm text-[var(--accent)] animate-fade-in-up">
          You received 100,000 USD and 50 ETH test tokens.
        </div>
      )}
    </>
  );
}
