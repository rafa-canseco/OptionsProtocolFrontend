"use client";

import { useState, useEffect } from "react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { InfoTooltip } from "./ui/InfoTooltip";
import type { LeaderboardTrack1Entry, LeaderboardTrack2Entry } from "@/lib/api";

// Competition: Apr 1 – Apr 15 2026 UTC
const COMPETITION_END_MS = 1776297599 * 1000;

type Tab = "track1" | "track2";

function truncateWallet(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function useCountdown(targetMs: number): string {
  const [remaining, setRemaining] = useState(() => targetMs - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(targetMs - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (remaining <= 0) return "Ended";
  const totalSecs = Math.floor(remaining / 1000);
  const d = Math.floor(totalSecs / 86400);
  const h = Math.floor((totalSecs % 86400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m ${s}s`;
}

function isCurrentUser(wallet: string, address: string | undefined): boolean {
  if (!address) return false;
  return wallet.toLowerCase() === address.toLowerCase();
}

function Track1Row({
  entry,
  address,
}: {
  entry: LeaderboardTrack1Entry;
  address: string | undefined;
}) {
  const mine = isCurrentUser(entry.wallet, address);
  return (
    <tr
      className={`border-b border-[var(--border)] transition-colors ${
        mine
          ? "bg-[var(--accent)]/10 border-l-2 border-l-[var(--accent)]"
          : "hover:bg-[var(--surface)]"
      }`}
    >
      <td className="py-3 px-3 text-sm font-mono text-[var(--text-secondary)] w-8">
        {entry.rank}
      </td>
      <td className="py-3 px-3 text-sm font-mono text-[var(--text)]">
        {truncateWallet(entry.wallet)}
        {mine && (
          <span className="ml-1.5 text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wide">
            you
          </span>
        )}
      </td>
      <td className="py-3 px-3 text-sm font-semibold text-[var(--accent)] text-right">
        {entry.earning_rate !== null
          ? `${(entry.earning_rate * 100).toFixed(1)}%`
          : "—"}
      </td>
      <td className="py-3 px-3 text-sm text-[var(--bone)] text-right hidden sm:table-cell">
        ${entry.total_earned_usd.toFixed(2)}
      </td>
      <td className="py-3 px-3 text-sm text-[var(--text-secondary)] text-right hidden sm:table-cell">
        {entry.position_count}
      </td>
      <td className="py-3 px-3 text-sm text-[var(--text-secondary)] text-right hidden md:table-cell">
        {entry.wheel_count > 0 ? `${entry.wheel_count} ↺` : "—"}
      </td>
    </tr>
  );
}

function Track2Row({
  entry,
  address,
}: {
  entry: LeaderboardTrack2Entry;
  address: string | undefined;
}) {
  const mine = isCurrentUser(entry.wallet, address);
  return (
    <tr
      className={`border-b border-[var(--border)] transition-colors ${
        mine
          ? "bg-[var(--accent)]/10 border-l-2 border-l-[var(--accent)]"
          : "hover:bg-[var(--surface)]"
      }`}
    >
      <td className="py-3 px-3 text-sm font-mono text-[var(--text-secondary)] w-8">
        {entry.rank}
      </td>
      <td className="py-3 px-3 text-sm font-mono text-[var(--text)]">
        {truncateWallet(entry.wallet)}
        {mine && (
          <span className="ml-1.5 text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wide">
            you
          </span>
        )}
      </td>
      <td className="py-3 px-3 text-sm font-semibold text-[var(--accent)] text-right">
        {entry.otm_streak}
      </td>
      <td className="py-3 px-3 text-sm text-[var(--text-secondary)] text-right hidden sm:table-cell">
        {entry.position_count}
      </td>
    </tr>
  );
}

export function EarningsChallenge({ address }: { address: string | undefined }) {
  const { data, loading, error } = useLeaderboard();
  const countdown = useCountdown(COMPETITION_END_MS);
  const [tab, setTab] = useState<Tab>("track1");

  const week = data?.meta.current_week ?? 1;

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              Earnings Challenge · Week {week} of 2
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              ends in {countdown}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Set your price, earn premium, climb the leaderboard. Apr 1–15.
          </p>
        </div>
        <div className="flex gap-4 shrink-0 text-xs">
          <div className="text-center">
            <p className="text-[var(--text-secondary)]">Best rate</p>
            <p className="font-semibold text-[var(--bone)]">$100</p>
          </div>
          <div className="text-center">
            <p className="text-[var(--text-secondary)]">Perfect run</p>
            <p className="font-semibold text-[var(--bone)]">$50</p>
          </div>
        </div>
      </div>

      {/* Leaderboard card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-[var(--border)]">
          <button
            onClick={() => setTab("track1")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === "track1"
                ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text)]"
            }`}
          >
            Earning Rate
          </button>
          <button
            onClick={() => setTab("track2")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === "track2"
                ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text)]"
            }`}
          >
            Safe Streak
          </button>
        </div>

        {loading && (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-xl bg-[var(--surface)]"
              />
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-[var(--text-secondary)] text-center py-8">
            Leaderboard unavailable. Try again later.
          </p>
        )}

        {!loading && !error && data && (
          <>
            {tab === "track1" && (
              <div className="overflow-x-auto">
                {data.track1.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)] text-center py-8">
                    No qualifying entries yet.
                  </p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="py-2 px-3 text-xs text-[var(--text-secondary)] text-left w-8">#</th>
                        <th className="py-2 px-3 text-xs text-[var(--text-secondary)] text-left">Wallet</th>
                        <th className="py-2 px-3 text-left">
                          <span className="inline-flex items-center text-xs text-[var(--text-secondary)]">
                            Rate
                            <InfoTooltip
                              title="Earning Rate"
                              text="Total premium earned divided by capital committed. Higher means you're getting more premium per dollar locked. Bonuses (Wheel, Perfect Week) increase your adjusted premium."
                            />
                          </span>
                        </th>
                        <th className="py-2 px-3 text-xs text-[var(--text-secondary)] text-right hidden sm:table-cell">Earned</th>
                        <th className="py-2 px-3 text-xs text-[var(--text-secondary)] text-right hidden sm:table-cell">Pos</th>
                        <th className="py-2 px-3 text-right hidden md:table-cell">
                          <span className="inline-flex items-center justify-end text-xs text-[var(--text-secondary)]">
                            Wheel ↺
                            <InfoTooltip
                              title="Wheel Bonus (1.5×)"
                              text="When a position gets assigned and you immediately open a new one on the other side (within 24h), both positions earn 1.5× premium. This is the Wheel — turning an assignment into a new opportunity."
                            />
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.track1.map((entry) => (
                        <Track1Row key={entry.wallet} entry={entry} address={address} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === "track2" && (
              <div className="overflow-x-auto">
                {data.track2.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)] text-center py-8">
                    No qualifying entries yet.
                  </p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="py-2 px-3 text-xs text-[var(--text-secondary)] text-left w-8">#</th>
                        <th className="py-2 px-3 text-xs text-[var(--text-secondary)] text-left">Wallet</th>
                        <th className="py-2 px-3 text-left">
                          <span className="inline-flex items-center text-xs text-[var(--text-secondary)]">
                            Streak
                            <InfoTooltip
                              title="Safe Streak"
                              text="Longest run of consecutive positions that expired without assignment. A position expires safely when the price stays on your side and you keep the full premium."
                            />
                          </span>
                        </th>
                        <th className="py-2 px-3 text-xs text-[var(--text-secondary)] text-right hidden sm:table-cell">Pos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.track2.map((entry) => (
                        <Track2Row key={entry.wallet} entry={entry} address={address} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div className="px-4 py-2 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--text-secondary)]">
                Qualifies at $500+ committed &amp; 8+ active days
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
