"use client";

import { ConnectButton } from "@/components/ConnectButton";
import { PositionCard } from "@/components/PositionCard";
import { useWallet } from "@/hooks/useWallet";
import { usePositions } from "@/hooks/usePositions";
import Link from "next/link";

export default function PositionsPage() {
  const { address, isConnected } = useWallet();
  const { positions, loading, error } = usePositions(address);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-[var(--card-border)] px-6 py-4">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold">Options Protocol</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/" className="text-[var(--muted)] hover:text-white">
              Trade
            </Link>
            <Link href="/positions" className="text-white">
              Positions
            </Link>
          </nav>
        </div>
        <ConnectButton />
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <h2 className="text-lg font-bold">My Positions</h2>

        {!isConnected ? (
          <p className="text-sm text-[var(--muted)]">Connect your wallet to view positions.</p>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-[var(--card)]" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-[var(--danger)] bg-red-900/20 p-4 text-sm">
            {error}
          </div>
        ) : positions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No positions yet. Accept a price to get started.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {positions.map((pos) => (
              <PositionCard key={pos.id} position={pos} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
