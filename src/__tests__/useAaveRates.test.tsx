import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const GATEWAY = "https://baserpcgateway-production.up.railway.app";

async function loadHookForSepolia() {
  process.env.NEXT_PUBLIC_CHAIN_ID = "84532";
  process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "testnet";
  process.env.NEXT_PUBLIC_RPC_URL = "https://sepolia.example.invalid";
  vi.resetModules();
  return import("@/hooks/useAaveRates");
}

describe("useAaveRates RPC routing", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("keeps mainnet Aave reads on the mainnet gateway from Sepolia", async () => {
    const requestUrls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      requestUrls.push(input instanceof Request ? input.url : String(input));
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          error: { code: -32000, message: "test response" },
        }),
        { headers: { "content-type": "application/json" } },
      );
    });
    const { useAaveRates } = await loadHookForSepolia();

    const { result } = renderHook(() => useAaveRates());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(requestUrls.length).toBeGreaterThan(0);
    expect(requestUrls.every((url) => new URL(url).origin === GATEWAY)).toBe(true);
    expect(requestUrls.every((url) => !url.includes("sepolia.example.invalid"))).toBe(true);
  });
});
