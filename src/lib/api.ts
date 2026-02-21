const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEMO_API_KEY = process.env.NEXT_PUBLIC_DEMO_API_KEY || "";

export type OptionType = "call" | "put";

export interface PriceQuote {
  option_type: OptionType;
  strike: number;
  expiry_days: number;
  premium: number;
  delta: number;
  iv: number;
  spot: number;
  ttl: number;
  expires_at: number;
  available_amount: number;
  otoken_address: string | null;
}

export interface Position {
  id: string;
  tx_hash: string;
  block_number: number;
  user_address: string;
  otoken_address: string;
  amount: number;
  premium: string;
  collateral: number;
  vault_id: number;
  strike_price: number;
  expiry: number;
  is_put: boolean;
  is_settled: boolean;
  settled_at: string | null;
  settlement_tx_hash: string | null;
  indexed_at: string;
  settlement_type: string | null;
  delivered_asset: string | null;
  delivered_amount: number | null;
  delivery_tx_hash: string | null;
  is_itm: boolean | null;
  expiry_price: number | null;
  gross_premium: string;
  net_premium: string;
  protocol_fee: string;
  outcome: string | null;
}

export interface SimulateResult {
  premium_earned: number;
  was_assigned: boolean;
  eth_low_of_week: number;
  eth_close: number;
  comparison: {
    hold_return: number;
    stake_return: number;
    dca_return: number;
  };
}

export interface AnalyticsEvent {
  session_id: string;
  event_type: string;
  data?: Record<string, unknown>;
}

export interface SettleResult {
  settled: boolean;
  is_itm: boolean;
  settlement_type: string;
  expiry_price: number;
  delivered_asset?: string;
  delivered_amount?: number;
}

export interface WeeklyReport {
  week_start: string;
  week_end: string;
  total_users: number;
  total_positions: number;
  total_simulated_premium: number;
  total_assignments: number;
  eth_open: number;
  eth_close: number;
  eth_high: number;
  eth_low: number;
  narrative_data: Record<string, unknown>;
}

export interface UserWeeklyResult {
  user_address: string;
  week_start: string;
  week_end: string;
  positions_opened: number;
  total_simulated_premium: number;
  assignments: number;
  simulated_pnl: number;
  cumulative_pnl: number;
}

export interface UserStats {
  user_address: string;
  weeks_active: number;
  cumulative_pnl: number;
  best_week_pnl: number;
  total_premium_earned: number;
  total_assignments: number;
  total_positions: number;
}

async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

export const api = {
  getPrices: () => fetchAPI<PriceQuote[]>("/prices"),

  getPositions: (address: string) =>
    fetchAPI<Position[]>(`/positions/${address}`),

  joinWaitlist: (email: string) =>
    fetchAPI<{ ok: boolean }>("/waitlist", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  demoSettle: (userAddress: string, vaultId: number, otokenAddress: string, forceItm?: boolean) =>
    fetchAPI<SettleResult>("/demo/settle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(DEMO_API_KEY ? { "X-Demo-Key": DEMO_API_KEY } : {}),
      },
      body: JSON.stringify({
        user_address: userAddress,
        vault_id: vaultId,
        otoken_address: otokenAddress,
        ...(forceItm !== undefined ? { force_itm: forceItm } : {}),
      }),
    }),

  simulate: (strike: number, side: "buy" | "sell") =>
    fetchAPI<SimulateResult>(`/prices/simulate?strike=${strike}&side=${side}`),

  trackEvent: (event: AnalyticsEvent) =>
    fetchAPI<{ ok: boolean }>("/analytics/event", {
      method: "POST",
      body: JSON.stringify(event),
    }),

  getWeeklyReport: () =>
    fetchAPI<WeeklyReport | null>("/results/weekly"),

  getUserWeeklyResult: (address: string) =>
    fetchAPI<UserWeeklyResult | null>(`/results/weekly/${address}`),

  getUserStats: (address: string) =>
    fetchAPI<UserStats | null>(`/results/stats/${address}`),
};
