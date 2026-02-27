"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { useFaucet } from "@/hooks/useFaucet";
import { ConnectButton } from "./ConnectButton";

const LINKS = [
  { href: "/earn", label: "Earn" },
  { href: "/positions", label: "My earnings" },
];

export function NavBar() {
  const pathname = usePathname();
  const { address, sendBatchTx, chainError, isConnected } = useWallet();
  const { usd, usdFormatted, ethFormatted, loading: balLoading, refetch } = useBalances(address);
  const { mint, minting, showNotification, error: faucetError } = useFaucet(address, sendBatchTx, refetch);

  const showFaucetButton = isConnected && !balLoading;

  const isStaging = typeof window !== "undefined" && window.location.hostname.startsWith("staging");

  return (
    <>
      {isStaging && (
        <div className="bg-amber-500 text-black text-center text-xs font-bold py-1">
          STAGING — staging.b1nary.app
        </div>
      )}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold tracking-tight text-[var(--bone)] font-mono">
            b<span className="text-[var(--accent)]">1</span>nary
          </Link>
          <nav className="flex gap-4 text-sm">
            {LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`transition-colors ${
                  pathname.startsWith(href)
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
          {isConnected && !balLoading && usd > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
              <span>{usdFormatted} USD</span>
              <span className="opacity-40">·</span>
              <span>{ethFormatted} ETH</span>
            </div>
          )}
          {showFaucetButton && (
            <button
              onClick={mint}
              disabled={minting}
              className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
            >
              {minting ? "Minting..." : "Get Test Tokens"}
            </button>
          )}
          <ConnectButton />
        </div>
      </header>

      {showNotification && (
        <div className="mx-6 mt-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-4 py-2.5 text-sm text-[var(--accent)] animate-fade-in-up">
          You received 100,000 USD and 50 ETH test tokens.
        </div>
      )}

      {chainError && (
        <div className="mx-6 mt-2 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20 px-4 py-2.5 text-sm text-[var(--danger)]">
          {chainError}
        </div>
      )}

      {faucetError && (
        <div className="mx-6 mt-2 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20 px-4 py-2.5 text-sm text-[var(--danger)]">
          {faucetError}
        </div>
      )}
    </>
  );
}
