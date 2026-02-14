const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
}

export interface AcceptOrderRequest {
  user_address: string;
  option_type: OptionType;
  strike: number;
  expiry_days: number;
  premium: number;
  spot_at_lock: number;
  iv_at_lock: number;
}

export interface AcceptOrderResponse {
  order_id: string;
  status: string;
}

export type OrderStatus = "pending" | "batched" | "settled" | "expired" | "failed";

export interface Position {
  id: string;
  user_address: string;
  option_type: OptionType;
  strike: number;
  expiry_days: number;
  premium: number;
  spot_at_lock: number;
  iv_at_lock: number;
  status: OrderStatus;
  batch_id: string | null;
  created_at: string;
  settled_at: string | null;
  tx_hash: string | null;
}

export interface BatchStatus {
  pending_orders: number;
  batch_interval_minutes: number;
  last_batch_at: string | null;
  circuit_breaker: {
    is_paused: boolean;
    pause_reason: string | null;
    reference_price: number | null;
  };
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

  acceptOrder: (order: AcceptOrderRequest) =>
    fetchAPI<AcceptOrderResponse>("/accept", {
      method: "POST",
      body: JSON.stringify(order),
    }),

  getPositions: (address: string) =>
    fetchAPI<Position[]>(`/positions/${address}`),

  getBatchStatus: () => fetchAPI<BatchStatus>("/batch/status"),
};
