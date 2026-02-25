"use client";

import { useState, useMemo, useCallback } from "react";
import type { WeeklySnapshot } from "@/lib/api";

type Period = "1M" | "3M" | "ALL";
const PERIODS: Period[] = ["1M", "3M", "ALL"];
const PERIOD_WEEKS: Record<Period, number> = { "1M": 4, "3M": 12, "ALL": Infinity };

interface Props {
  history: WeeklySnapshot[];
  loading: boolean;
}

function formatWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatUsd(value: number): string {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${Math.round(value)}`;
}

export function EarningsChart({ history, loading }: Props) {
  const [period, setPeriod] = useState<Period>("ALL");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const maxWeeks = PERIOD_WEEKS[period];
    if (maxWeeks === Infinity) return history;
    return history.slice(-maxWeeks);
  }, [history, period]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (filtered.length === 0) return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      const idx = Math.round(ratio * (filtered.length - 1));
      setHoverIdx(Math.max(0, Math.min(filtered.length - 1, idx)));
    },
    [filtered.length],
  );

  if (loading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-[var(--surface)]" />;
  }

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center space-y-2">
        <p className="text-sm text-[var(--text-secondary)]">
          Earnings will appear after your first settled position
        </p>
        <p className="text-xs text-[var(--text-secondary)] opacity-60">
          Your cumulative earnings chart will show here
        </p>
      </div>
    );
  }

  // Chart dimensions
  const W = 480;
  const H = 200;
  const PAD_T = 20;
  const PAD_B = 28;
  const PAD_L = 44;
  const PAD_R = 12;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const values = filtered.map((s) => s.cumulative_pnl);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(0, ...values);
  const range = maxVal - minVal || 1;
  const yPad = range * 0.1;
  const yMin = minVal - yPad;
  const yMax = maxVal + yPad;
  const yRange = yMax - yMin;

  const toX = (i: number) =>
    PAD_L + (filtered.length > 1 ? (i / (filtered.length - 1)) * plotW : plotW / 2);
  const toY = (val: number) => PAD_T + (1 - (val - yMin) / yRange) * plotH;

  // Line + area paths
  const linePoints = filtered.map((s, i) => `${toX(i)},${toY(s.cumulative_pnl)}`);
  const linePath = `M${linePoints.join(" L")}`;
  const areaPath = `${linePath} L${toX(filtered.length - 1)},${toY(yMin)} L${toX(0)},${toY(yMin)} Z`;

  // Y-axis ticks (3-5 ticks)
  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount }, (_, i) => {
    const val = yMin + (yRange * i) / (tickCount - 1);
    return { val, y: toY(val) };
  });

  // X-axis labels (show up to 6 evenly spaced)
  const maxLabels = Math.min(6, filtered.length);
  const xLabels =
    filtered.length <= maxLabels
      ? filtered.map((s, i) => ({ label: formatWeek(s.week_start), x: toX(i) }))
      : Array.from({ length: maxLabels }, (_, i) => {
          const idx = Math.round((i / (maxLabels - 1)) * (filtered.length - 1));
          return { label: formatWeek(filtered[idx].week_start), x: toX(idx) };
        });

  const hovered = hoverIdx !== null ? filtered[hoverIdx] : null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 space-y-3 animate-fade-in-up">
      {/* Header: legend + period tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px] text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded-full bg-[var(--accent)]" />
            Cumulative earnings
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--danger)]" />
            Assignment week
          </span>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors duration-150 ${
                period === p
                  ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      <div className="h-5">
        {hovered ? (
          <div className="flex items-center gap-3 text-xs animate-fade-in">
            <span className="text-[var(--text-secondary)]">
              {formatWeek(hovered.week_start)} – {formatWeek(hovered.week_end)}
            </span>
            <span className="font-mono font-semibold text-[var(--accent)]">
              {formatUsd(hovered.cumulative_pnl)}
            </span>
            <span
              className={`font-mono text-[10px] ${
                hovered.pnl >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"
              }`}
            >
              {hovered.pnl >= 0 ? "+" : ""}
              {formatUsd(hovered.pnl)}
            </span>
          </div>
        ) : (
          <p className="text-xs text-[var(--text-secondary)] opacity-60">
            Hover to see weekly details
          </p>
        )}
      </div>

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Grid lines + Y labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              y1={t.y}
              x2={W - PAD_R}
              y2={t.y}
              stroke="var(--border)"
              strokeWidth={0.5}
            />
            <text
              x={PAD_L - 6}
              y={t.y + 3}
              textAnchor="end"
              fill="var(--text-secondary)"
              fontSize={9}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {formatUsd(t.val)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={H - 6}
            textAnchor="middle"
            fill="var(--text-secondary)"
            fontSize={8}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {l.label}
          </text>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#earningsGrad)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {filtered.map((s, i) => {
          const cx = toX(i);
          const cy = toY(s.cumulative_pnl);
          const isAssignment = s.assignments > 0;
          const isHovered = hoverIdx === i;

          return (
            <g key={i}>
              {isAssignment && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : 4.5}
                  fill="var(--danger)"
                  opacity={isHovered ? 1 : 0.8}
                />
              )}
              {(isHovered || isAssignment) && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 4 : 2.5}
                  fill={isAssignment ? "var(--danger)" : "var(--accent)"}
                  stroke={isAssignment ? "var(--danger)" : "var(--accent)"}
                  strokeWidth={isHovered ? 2 : 0}
                  strokeOpacity={0.3}
                />
              )}
              {isHovered && !isAssignment && (
                <circle cx={cx} cy={cy} r={4} fill="var(--accent)" />
              )}
              {/* Vertical guide on hover */}
              {isHovered && (
                <line
                  x1={cx}
                  y1={PAD_T}
                  x2={cx}
                  y2={PAD_T + plotH}
                  stroke="var(--text-secondary)"
                  strokeWidth={0.5}
                  strokeDasharray="3 2"
                  opacity={0.4}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
