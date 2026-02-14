"use client";

import { ConnectButton } from "@/components/ConnectButton";
import { PriceMenu } from "@/components/PriceMenu";
import { BatchTimer } from "@/components/BatchTimer";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-[var(--card-border)] px-6 py-4">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold">Options Protocol</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/" className="text-white">
              Trade
            </Link>
            <Link href="/positions" className="text-[var(--muted)] hover:text-white">
              Positions
            </Link>
          </nav>
        </div>
        <ConnectButton />
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <BatchTimer />
        <PriceMenu />
      </main>
    </div>
  );
}
