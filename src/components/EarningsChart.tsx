"use client";

import { useState, useMemo, useCallback } from "react";
import type { WeeklySnapshot } from "@/lib/api";

type Period = "1M" | "3M" | "ALL";
const PERIODS: Period[] = ["1M", "3M", "ALL"];
const PERIOD_WEEKS: Record<Period, number> = { "1M": 4, "3M": 12, "ALL": Infinity };

// Hardcode chart colors to avoid shadcn CSS variable conflicts
const ACCENT = "#22D3EE";
const ACCENT_FILL_TOP = "rgba(34, 211, 238, 0.25)";
const ACCENT_FILL_BOT = "rgba(34, 211, 238, 0.02)";
const DANGER = "#EF4444";
const GRID = "#27272A";
const TEXT_SEC = "#A1A1AA";
const FONT_MONO = "'JetBrains Mono', monospace";

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
    const data = maxWeeks === Infinity ? history : history.slice(-maxWeeks);

    // Always prepend an origin point ($0) so the chart has at least 2 points
    // and the area fill starts from zero
    if (data.length > 0) {
      const first = data[0];
      const originDate = new Date(first.week_start + "T00:00:00");
      originDate.setDate(originDate.getDate() - 7);
      const originStr = originDate.toISOString().slice(0, 10);
      return [
        {
          week_start: originStr,
          week_end: first.week_start,
          premium_earned: 0,
          assignments: 0,
          pnl: 0,
          cumulative_pnl: 0,
        },
        ...data,
      ];
    }
    return data;
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
    return <div className="h-56 animate-pulse rounded-2xl bg-[var(--surface)]" />;
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
  const H = 220;
  const PAD_T = 24;
  const PAD_B = 32;
  const PAD_L = 48;
  const PAD_R = 16;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const values = filtered.map((s) => s.cumulative_pnl);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  // Floor at 0 when all values are non-negative
  const yFloor = minVal >= 0 ? 0 : minVal;
  const range = maxVal - yFloor || 1;
  const yPad = range * 0.12;
  const yMin = yFloor;
  const yMax = maxVal + yPad;
  const yRange = yMax - yMin || 1;

  const toX = (i: number) =>
    PAD_L + (filtered.length > 1 ? (i / (filtered.length - 1)) * plotW : plotW / 2);
  const toY = (val: number) => PAD_T + (1 - (val - yMin) / yRange) * plotH;

  // Line + area paths
  const linePoints = filtered.map((s, i) => `${toX(i)},${toY(s.cumulative_pnl)}`);
  const linePath = `M${linePoints.join(" L")}`;
  const baselineY = toY(yMin);
  const areaPath = `${linePath} L${toX(filtered.length - 1)},${baselineY} L${toX(0)},${baselineY} Z`;

  // Y-axis ticks
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount }, (_, i) => {
    const val = yMin + (yRange * i) / (tickCount - 1);
    return { val, y: toY(val) };
  });

  // X-axis labels — show all when few, sample evenly when many
  const maxLabels = Math.min(6, filtered.length);
  const xLabels =
    filtered.length <= maxLabels
      ? filtered.map((s, i) => ({ label: formatWeek(s.week_start), x: toX(i) }))
      : Array.from({ length: maxLabels }, (_, i) => {
          const idx = Math.round((i / (maxLabels - 1)) * (filtered.length - 1));
          return { label: formatWeek(filtered[idx].week_start), x: toX(idx) };
        });

  const hovered = hoverIdx !== null ? filtered[hoverIdx] : null;
  // Don't show tooltip for the synthetic origin point
  const hoveredReal = hovered && hoverIdx !== 0 ? hovered : null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 space-y-3 animate-fade-in-up">
      {/* Header: legend + period tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px]" style={{ color: TEXT_SEC }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded-full" style={{ background: ACCENT }} />
            Cumulative earnings
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: DANGER }} />
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
        {hoveredReal ? (
          <div className="flex items-center gap-3 text-xs">
            <span style={{ color: TEXT_SEC }}>
              {formatWeek(hoveredReal.week_start)} – {formatWeek(hoveredReal.week_end)}
            </span>
            <span className="font-mono font-semibold" style={{ color: ACCENT }}>
              {formatUsd(hoveredReal.cumulative_pnl)}
            </span>
            <span
              className="font-mono text-[10px]"
              style={{ color: hoveredReal.pnl >= 0 ? ACCENT : DANGER }}
            >
              {hoveredReal.pnl >= 0 ? "+" : ""}
              {formatUsd(hoveredReal.pnl)}
            </span>
          </div>
        ) : (
          <p className="text-xs opacity-60" style={{ color: TEXT_SEC }}>
            Hover to see weekly details
          </p>
        )}
      </div>

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minHeight: 180 }}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT_FILL_TOP} />
            <stop offset="100%" stopColor={ACCENT_FILL_BOT} />
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
              stroke={GRID}
              strokeWidth={0.5}
            />
            <text
              x={PAD_L - 8}
              y={t.y + 3}
              textAnchor="end"
              fill={TEXT_SEC}
              fontSize={9}
              style={{ fontFamily: FONT_MONO }}
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
            y={H - 8}
            textAnchor="middle"
            fill={TEXT_SEC}
            fontSize={8}
            style={{ fontFamily: FONT_MONO }}
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
          stroke={ACCENT}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points — always visible */}
        {filtered.map((s, i) => {
          const cx = toX(i);
          const cy = toY(s.cumulative_pnl);
          const isAssignment = s.assignments > 0;
          const isHovered = hoverIdx === i;
          const isOrigin = i === 0;

          return (
            <g key={i}>
              {/* Vertical guide on hover */}
              {isHovered && !isOrigin && (
                <line
                  x1={cx}
                  y1={PAD_T}
                  x2={cx}
                  y2={PAD_T + plotH}
                  stroke={TEXT_SEC}
                  strokeWidth={0.5}
                  strokeDasharray="3 2"
                  opacity={0.4}
                />
              )}

              {/* Assignment outer ring */}
              {isAssignment && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 7 : 5}
                  fill={DANGER}
                  opacity={0.25}
                />
              )}

              {/* Dot — always visible (smaller for non-hovered) */}
              {!isOrigin && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5 : isAssignment ? 3.5 : 2.5}
                  fill={isAssignment ? DANGER : ACCENT}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
