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

export interface SettleResult {
  settled: boolean;
  is_itm: boolean;
  settlement_type: string;
  expiry_price: number;
  delivered_asset?: string;
  delivered_amount?: number;
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
};
