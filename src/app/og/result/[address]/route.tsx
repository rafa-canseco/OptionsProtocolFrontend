import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UserWeeklyResult {
  user_address: string;
  week_start: string;
  week_end: string;
  positions_opened: number;
  total_simulated_premium: number;
  assignments: number;
  simulated_pnl: number;
  cumulative_pnl: number;
}

interface UserStats {
  weeks_active: number;
  cumulative_pnl: number;
  best_week_pnl: number;
  total_premium_earned: number;
  total_assignments: number;
  total_positions: number;
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  let weeklyResult: UserWeeklyResult | null = null;
  let stats: UserStats | null = null;

  try {
    const [wRes, sRes] = await Promise.all([
      fetch(`${API_BASE}/results/weekly/${address}`),
      fetch(`${API_BASE}/results/stats/${address}`),
    ]);
    if (wRes.ok) weeklyResult = await wRes.json();
    if (sRes.ok) stats = await sRes.json();
  } catch {
    // Fall through to render a generic card
  }

  const pnl = weeklyResult?.simulated_pnl ?? 0;
  const pnlColor = pnl >= 0 ? "#34D399" : "#F87171";
  const pnlSign = pnl >= 0 ? "+" : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200",
          height: "630",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px",
          backgroundColor: "#0A0A0A",
          color: "#FAFAFA",
          fontFamily: "monospace",
        }}
      >
        {/* Top: brand + week */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>
            <span style={{ color: "#F0EBE3" }}>b</span>
            <span style={{ color: "#22D3EE" }}>1</span>
            <span style={{ color: "#F0EBE3" }}>nary simulator</span>
          </div>
          {weeklyResult && (
            <div style={{ fontSize: 20, color: "#A1A1AA" }}>
              Week of {formatDate(weeklyResult.week_start)}–
              {formatDate(weeklyResult.week_end)}
            </div>
          )}
        </div>

        {/* Middle: main result */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
          }}
        >
          {weeklyResult ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 20, color: "#A1A1AA", marginBottom: 8 }}>
                {shortAddr(address)}
              </div>
              <div
                style={{
                  fontSize: 80,
                  fontWeight: 700,
                  color: pnlColor,
                  lineHeight: 1,
                }}
              >
                {pnlSign}${Math.abs(pnl).toFixed(0)}
              </div>
              <div style={{ fontSize: 22, color: "#A1A1AA", marginTop: 12 }}>
                Premium earned: ${weeklyResult.total_simulated_premium.toFixed(0)}
                {" · "}
                {weeklyResult.positions_opened} position
                {weeklyResult.positions_opened !== 1 ? "s" : ""}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 20, color: "#A1A1AA", marginBottom: 8 }}>
                {shortAddr(address)}
              </div>
              <div
                style={{ fontSize: 48, fontWeight: 700, color: "#F0EBE3" }}
              >
                No results yet
              </div>
            </div>
          )}
        </div>

        {/* Bottom: stats + URL */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", gap: 40 }}>
            {stats && (
              <>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 14, color: "#A1A1AA" }}>
                    Weeks active
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#FAFAFA" }}>
                    {stats.weeks_active}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 14, color: "#A1A1AA" }}>
                    Total earned
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#22D3EE" }}>
                    ${stats.total_premium_earned.toFixed(0)}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 14, color: "#A1A1AA" }}>
                    Best week
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#34D399" }}>
                    +${stats.best_week_pnl.toFixed(0)}
                  </div>
                </div>
              </>
            )}
          </div>
          <div style={{ fontSize: 18, color: "#A1A1AA" }}>try.b1nary.xyz</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
