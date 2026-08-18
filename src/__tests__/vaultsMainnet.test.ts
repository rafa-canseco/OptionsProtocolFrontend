import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/contracts", () => ({
  CHAIN: { id: 8453 },
  ERC20_ABI: [],
  publicClient: {},
}));

vi.mock("@/lib/fundVault", () => ({
  rawFundAmount: () => 0,
}));

import {
  COVERED_CALL_VAULT_CARD,
  CSP_VAULT_CARD,
  vaultCardMetadata,
} from "@/lib/vaults";
import { ASSETS } from "@/lib/assets";

describe("vaultCardMetadata on Base mainnet (8453)", () => {
  it("marks ETH CSP and covered-call vaults as coming-soon", () => {
    expect(vaultCardMetadata("csp", ASSETS.eth).availability).toBe(
      "coming-soon",
    );
    expect(vaultCardMetadata("covered-call", ASSETS.eth).availability).toBe(
      "coming-soon",
    );
  });

  it("keeps the static ETH vault cards coming-soon on mainnet", () => {
    expect(CSP_VAULT_CARD.availability).toBe("coming-soon");
    expect(COVERED_CALL_VAULT_CARD.availability).toBe("coming-soon");
  });
});
