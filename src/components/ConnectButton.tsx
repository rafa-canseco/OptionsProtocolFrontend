"use client";

import { useWallet } from "@/hooks/useWallet";

export function ConnectButton() {
  const { address, isConnected, isReady, login, logout } = useWallet();

  if (!isReady) return <div className="h-9 w-24 animate-pulse rounded-full bg-[var(--surface)]" />;

  if (isConnected && address) {
    return (
      <button
        onClick={logout}
        className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--text-secondary)] transition-colors"
      >
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={login}
      className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors"
    >
      Connect
    </button>
  );
}
