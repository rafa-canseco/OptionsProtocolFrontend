"use client";

export function DistanceIndicator({
  strike,
  spot,
  isPut,
  isSettled,
  expiryPrice,
  size = "compact",
}: {
  strike: number;
  spot: number;
  isPut: boolean;
  isSettled: boolean;
  expiryPrice?: number | null;
  size?: "compact" | "full";
}) {
  const price = isSettled && expiryPrice ? expiryPrice : spot;

  // Distance as percentage of strike
  const distance = Math.abs(price - strike) / strike;
  const distPct = distance * 100;

  // For puts: danger if price drops below strike. For calls: danger if price rises above strike.
  const crossed = isPut ? price <= strike : price >= strike;

  let color: string;
  let label: string;
  if (crossed) {
    color = "var(--danger)";
    label = isSettled ? "Crossed" : "At risk";
  } else if (distPct < 3) {
    color = "#F97316";
    label = `${distPct.toFixed(1)}% away`;
  } else if (distPct < 10) {
    color = "#F97316";
    label = `${distPct.toFixed(1)}% away`;
  } else {
    color = "var(--accent)";
    label = `${distPct.toFixed(0)}% away`;
  }

  // Map to bar position: 0 = far left, 1 = far right
  const lo = Math.min(price, strike);
  const hi = Math.max(price, strike);
  const padding = (hi - lo) * 0.5 || strike * 0.05;
  const rangeMin = lo - padding;
  const rangeMax = hi + padding;
  const rangeSpan = rangeMax - rangeMin || 1;

  const spotX = ((price - rangeMin) / rangeSpan) * 100;
  const strikeX = ((strike - rangeMin) / rangeSpan) * 100;

  if (size === "full") {
    const W = 400;
    const H = 44;
    const PAD = 16;
    const plotW = W - PAD * 2;
    const TRACK_Y = 22;
    const TRACK_H = 8;

    return (
      <div className="mt-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-[var(--text-secondary)]">
            {isSettled ? "Closing price" : "Price"} vs strike
          </span>
          <span className="text-xs font-semibold" style={{ color }}>
            {label}
          </span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: 40 }}>
          {/* Track */}
          <rect x={PAD} y={TRACK_Y - TRACK_H / 2} width={plotW} height={TRACK_H} rx={4} fill="var(--border)" />

          {/* Colored fill between spot and strike */}
          <rect
            x={PAD + (Math.min(spotX, strikeX) / 100) * plotW}
            y={TRACK_Y - TRACK_H / 2}
            width={(Math.abs(spotX - strikeX) / 100) * plotW}
            height={TRACK_H}
            rx={4}
            fill={color}
            opacity={0.35}
          />

          {/* Strike marker — vertical line */}
          <line
            x1={PAD + (strikeX / 100) * plotW}
            y1={TRACK_Y - 14}
            x2={PAD + (strikeX / 100) * plotW}
            y2={TRACK_Y + 14}
            stroke="var(--text-secondary)"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <text
            x={PAD + (strikeX / 100) * plotW}
            y={TRACK_Y - 18}
            textAnchor="middle"
            fill="var(--text-secondary)"
            fontSize={10}
            fontWeight={500}
          >
            ${strike.toLocaleString()}
          </text>

          {/* Spot marker — filled circle */}
          <circle
            cx={PAD + (spotX / 100) * plotW}
            cy={TRACK_Y}
            r={7}
            fill={color}
          />
          <circle
            cx={PAD + (spotX / 100) * plotW}
            cy={TRACK_Y}
            r={3}
            fill="var(--bg)"
          />
        </svg>
        {/* Price labels below the bar */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-[var(--text-secondary)]">
            Your price: <span className="font-mono font-medium text-[var(--text)]">${strike.toLocaleString()}</span>
          </span>
          <span className="text-xs text-[var(--text-secondary)]">
            ETH now: <span className="font-mono font-medium text-[var(--text)]">${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </span>
        </div>
      </div>
    );
  }

  // Compact mode (original)
  const W = 200;
  const H = 28;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[var(--text-secondary)]">
          {isSettled ? "Closing price" : "Spot"} vs strike
        </span>
        <span className="text-[10px] font-medium" style={{ color }}>
          {label}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 28 }}>
        {/* Track */}
        <rect x={10} y={12} width={W - 20} height={4} rx={2} fill="var(--border)" />

        {/* Colored fill between spot and strike */}
        <rect
          x={10 + (Math.min(spotX, strikeX) / 100) * (W - 20)}
          y={12}
          width={(Math.abs(spotX - strikeX) / 100) * (W - 20)}
          height={4}
          rx={2}
          fill={color}
          opacity={0.4}
        />

        {/* Strike marker */}
        <line
          x1={10 + (strikeX / 100) * (W - 20)}
          y1={6}
          x2={10 + (strikeX / 100) * (W - 20)}
          y2={22}
          stroke="var(--text-secondary)"
          strokeWidth={2}
        />
        <text
          x={10 + (strikeX / 100) * (W - 20)}
          y={4}
          textAnchor="middle"
          fill="var(--text-secondary)"
          fontSize={8}
        >
          ${strike.toLocaleString()}
        </text>

        {/* Spot marker */}
        <circle
          cx={10 + (spotX / 100) * (W - 20)}
          cy={14}
          r={5}
          fill={color}
        />
      </svg>
    </div>
  );
}
