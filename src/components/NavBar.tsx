"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useBalances } from "@/hooks/useBalances";
import { useSolanaBalance } from "@/hooks/useSolanaBalance";
import { useSpot } from "@/hooks/useSpot";
import { ConnectButton } from "./ConnectButton";
import { FaucetButton } from "./FaucetButton";
import { ASSETS } from "@/lib/assets";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const LINKS = [
  { href: "/earn", label: "Earn" },
  { href: "/positions", label: "My earnings" },
];

const SHOW_FAUCET = process.env.NEXT_PUBLIC_SHOW_FAUCET === "true";

function fmtUsd(value: number): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtAmount(value: number, decimals: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  });
}

export function NavBar() {
  const pathname = usePathname();
  const { address, fundingAddress, solanaAddress, isConnected } = useWallet();

  const { usd, eth, weth, wbtc, loading: balLoading, refetch } = useBalances(address);
  const {
    solanaUsdc,
    solanaSol,
    solanaWsol,
    solanaTslax,
    loading: solanaBalLoading,
  } = useSolanaBalance(solanaAddress);
  const { spot: ethSpot } = useSpot("eth");
  const { spot: btcSpot } = useSpot("btc");
  const { spot: solSpot } = useSpot("sol");
  const { spot: tslaxSpot } = useSpot("tslax");

  const isStaging = typeof window !== "undefined" && window.location.hostname.startsWith("staging");
  const totalSol = solanaSol + solanaWsol;
  const totalUsd =
    usd +
    solanaUsdc +
    (eth + weth) * (ethSpot ?? ASSETS.eth.fallbackSpot) +
    wbtc * (btcSpot ?? ASSETS.btc.fallbackSpot) +
    totalSol * (solSpot ?? ASSETS.sol.fallbackSpot) +
    solanaTslax * (tslaxSpot ?? ASSETS.tslax.fallbackSpot);
  const hasAnyBalance =
    usd > 0 || eth > 0 || weth > 0 || wbtc > 0 ||
    solanaUsdc > 0 || totalSol > 0 || solanaTslax > 0;
  const balancesLoading = balLoading || solanaBalLoading;

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
          {isConnected && (hasAnyBalance || balancesLoading) && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="hidden sm:flex items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--text-secondary)] transition-colors">
                  <img src="/usdc.svg" alt="" aria-hidden="true" className="w-4 h-4 inline" />
                  <span className="font-mono">
                    {balancesLoading ? "..." : fmtUsd(totalUsd)}
                  </span>
                  <span className="text-[var(--text-secondary)]">⌄</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[260px] p-3 border-[var(--border)] bg-[var(--bg)]"
                align="end"
              >
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-[var(--text)]">
                    <span className="font-semibold">Total value</span>
                    <span className="font-mono">{fmtUsd(totalUsd)}</span>
                  </div>
                  <div className="h-px bg-[var(--border)]" />
                  <div className="flex justify-between text-[var(--text)]">
                    <span>Base USDC</span>
                    <span className="font-mono">{fmtUsd(usd)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--text)]">
                    <span>Solana USDC</span>
                    <span className="font-mono">{fmtUsd(solanaUsdc)}</span>
                  </div>
                  {eth > 0 && (
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>ETH</span>
                      <span className="font-mono">{fmtAmount(eth, 4)}</span>
                    </div>
                  )}
                  {weth > 0 && (
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>WETH</span>
                      <span className="font-mono">{fmtAmount(weth, 4)}</span>
                    </div>
                  )}
                  {wbtc > 0 && (
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>cbBTC</span>
                      <span className="font-mono">{fmtAmount(wbtc, 6)}</span>
                    </div>
                  )}
                  {totalSol > 0 && (
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>SOL + wSOL</span>
                      <span className="font-mono">{fmtAmount(totalSol, 4)}</span>
                    </div>
                  )}
                  {solanaTslax > 0 && (
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>TSLAx</span>
                      <span className="font-mono">{fmtAmount(solanaTslax, 4)}</span>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {SHOW_FAUCET && isConnected && !balLoading && (fundingAddress || solanaAddress) && (
            <FaucetButton address={fundingAddress} solanaAddress={solanaAddress} refetch={refetch} />
          )}
          <ConnectButton />
        </div>
      </header>

    </>
  );
}
