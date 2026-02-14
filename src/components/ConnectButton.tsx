"use client";

import { useWallet } from "@/hooks/useWallet";

export function ConnectButton() {
  const { address, isConnected, isReady, login, logout } = useWallet();

  if (!isReady) return <div className="h-10 w-32 animate-pulse rounded-lg bg-[var(--card)]" />;

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--muted)]">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={logout}
          className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm hover:bg-[var(--card)]"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:bg-[var(--accent-dim)]"
    >
      Connect Wallet
    </button>
  );
}
