const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type OptionType = "call" | "put";

export interface PriceQuote {
  option_type: OptionType;
  strike: number;
  expiry_days: number;
  expiry_date: string;
  premium: number;
  delta: number;
  iv: number;
  spot: number;
  ttl: number;
  expires_at: number;
  available_amount: number;
  otoken_address: string | null;
  signature: string | null;
  mm_address: string | null;
  bid_price_raw: number | null;
  deadline: number | null;
  quote_id: string | null;
  max_amount_raw: number | null;
  maker_nonce: number | null;
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
    fetchAPI<{ ok: boolean; new: boolean }>("/waitlist", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  simulate: (strike: number, side: "buy" | "sell") =>
    fetchAPI<SimulateResult>(`/prices/simulate?strike=${strike}&side=${side}`),

  trackEvent: (event: AnalyticsEvent) =>
    fetchAPI<{ ok: boolean }>("/analytics/event", {
      method: "POST",
      body: JSON.stringify(event),
    }),

  getWaitlistCount: () =>
    fetchAPI<{ count: number }>("/waitlist/count"),

};
