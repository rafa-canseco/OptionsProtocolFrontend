import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/contracts", () => ({
  CHAIN: { id: 8453 },
  ADDRESSES: {},
  ERC20_ABI: [],
}));

import {
  FUND_ADDRESS,
  FUND_CHAIN_ID,
  FUND_KEY,
  configuredFundAddress,
  configuredFundKey,
} from "@/lib/fundVault";
import {
  BASE_SEPOLIA_COVERED_CALL_FUND,
  BASE_SEPOLIA_CSP_FUND,
  BASE_SEPOLIA_META_WHEEL_FUND,
} from "@/lib/fundDeployment";

describe("fund configuration on Base mainnet", () => {
  it("never falls back to Base Sepolia fund identities", () => {
    expect(FUND_KEY).toBe("");
    expect(FUND_ADDRESS).toBe("");
    expect(FUND_CHAIN_ID).toBeNull();

    for (const deployment of [
      BASE_SEPOLIA_CSP_FUND,
      BASE_SEPOLIA_COVERED_CALL_FUND,
      BASE_SEPOLIA_META_WHEEL_FUND,
    ]) {
      expect(configuredFundKey(deployment)).toBe("");
      expect(configuredFundAddress(deployment)).toBe("");
    }
  });
});
