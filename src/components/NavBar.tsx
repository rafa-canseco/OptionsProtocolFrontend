"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { ConnectButton } from "./ConnectButton";
import { FaucetButton } from "./FaucetButton";

const LINKS = [
  { href: "/earn", label: "Earn" },
  { href: "/positions", label: "My earnings" },
];

const SHOW_FAUCET = process.env.NEXT_PUBLIC_SHOW_FAUCET === "true";

export function NavBar() {
  const pathname = usePathname();
  const { address, sendBatchTx, chainError, isConnected } = useWallet();
  const { usd, usdFormatted, ethFormatted, loading: balLoading, refetch } = useBalances(address);

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
          {SHOW_FAUCET && isConnected && !balLoading && address && (
            <FaucetButton address={address} sendBatchTx={sendBatchTx} refetch={refetch} />
          )}
          <ConnectButton />
        </div>
      </header>

      {chainError && (
        <div className="mx-6 mt-2 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20 px-4 py-2.5 text-sm text-[var(--danger)]">
          {chainError}
        </div>
      )}
    </>
  );
}
