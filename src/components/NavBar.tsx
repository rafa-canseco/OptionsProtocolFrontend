"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWalletSummary } from "@/hooks/useWalletSummary";
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

function BalanceRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[var(--text-secondary)]">
      <span className="flex min-w-0 items-center gap-2">
        <img
          src={icon}
          alt=""
          aria-hidden="true"
          className="h-4 w-4 rounded-full"
        />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-right font-mono text-[var(--text)]">{value}</span>
    </div>
  );
}

type BalanceItem = {
  icon: string;
  label: string;
  value: string;
  amount: number;
};

export function NavBar() {
  const pathname = usePathname();
  const {
    address,
    fundingAddress,
    solanaAddress,
    baseAddresses,
    solanaAddresses,
    isConnected,
  } = useWalletSummary();

  const balanceAddresses = baseAddresses.length > 0 ? baseAddresses : address;
  const { usd, eth, weth, wbtc, loading: balLoading, refetch } =
    useBalances(balanceAddresses);
  const {
    solanaUsdc,
    solanaSol,
    solanaWsol,
    solanaTslax,
    loading: solanaBalLoading,
  } = useSolanaBalance(solanaAddresses.length > 0 ? solanaAddresses : solanaAddress);
  const { spot: ethSpot } = useSpot("eth");
  const { spot: btcSpot } = useSpot("btc");
  const { spot: solSpot } = useSpot("sol");
  const { spot: tslaxSpot } = useSpot("tslax");

  const isStaging = typeof window !== "undefined" && window.location.hostname.startsWith("staging");
  const totalUsdc = usd + solanaUsdc;
  const totalUsd =
    totalUsdc +
    (eth + weth) * (ethSpot ?? ASSETS.eth.fallbackSpot) +
    wbtc * (btcSpot ?? ASSETS.btc.fallbackSpot) +
    (solanaSol + solanaWsol) * (solSpot ?? ASSETS.sol.fallbackSpot) +
    solanaTslax * (tslaxSpot ?? ASSETS.tslax.fallbackSpot);
  const balancesLoading = balLoading || solanaBalLoading;
  const balanceItems: BalanceItem[] = [
    { icon: "/usdc.svg", label: "USDC", value: fmtUsd(totalUsdc), amount: totalUsdc },
    { icon: "/eth.png", label: "ETH", value: fmtAmount(eth, 4), amount: eth },
    { icon: "/weth.png", label: "WETH", value: fmtAmount(weth, 4), amount: weth },
    { icon: "/cbbtc.webp", label: "cbBTC", value: fmtAmount(wbtc, 6), amount: wbtc },
    { icon: "/sol.png", label: "SOL", value: fmtAmount(solanaSol, 4), amount: solanaSol },
    { icon: "/sol.png", label: "wSOL", value: fmtAmount(solanaWsol, 4), amount: solanaWsol },
    { icon: "/tslax.svg", label: "TSLAx", value: fmtAmount(solanaTslax, 4), amount: solanaTslax },
  ].sort((a, b) => {
    if (a.amount > 0 && b.amount <= 0) return -1;
    if (a.amount <= 0 && b.amount > 0) return 1;
    return 0;
  });

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
          {isConnected && (
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
                className="w-[220px] p-3 border-[var(--border)] bg-[var(--bg)]"
                align="end"
              >
                <div className="space-y-2 text-sm">
                  {balanceItems.map((item) => (
                    <BalanceRow
                      key={item.label}
                      icon={item.icon}
                      label={item.label}
                      value={item.value}
                    />
                  ))}
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
