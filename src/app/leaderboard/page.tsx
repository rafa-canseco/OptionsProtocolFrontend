"use client";

import { EarningsChallenge } from "@/components/EarningsChallenge";
import { useWallet } from "@/hooks/useWallet";

export default function LeaderboardPage() {
  const { address } = useWallet();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="sr-only">Earnings Challenge Leaderboard</h1>
      <EarningsChallenge address={address} />
    </main>
  );
}
