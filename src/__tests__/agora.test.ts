import { describe, expect, it } from "vitest";
import {
  AGORA_LIFECYCLE,
  agoraStatusLabel,
  buildDemoPreparedAllocation,
} from "@/lib/agora";

describe("agora helpers", () => {
  it("builds a prepared allocation without bridge-first language", () => {
    const prepared = buildDemoPreparedAllocation({
      userId: "user-1",
      sourceChain: "base",
      sourceWallet: "0x1234567890abcdef1234567890abcdef12345678",
      amount: 125.5,
      receiverAddress: "0xreceiver",
      metaVaultAddress: "0xvault",
    });

    expect(prepared.id).toContain("prepared-base");
    expect(prepared.status).toBe("allocation_created");
    expect(prepared.amount).toBe(125.5);
    expect(prepared.lifecycle).toEqual(AGORA_LIFECYCLE);
  });

  it("labels the judge-visible CCTP lifecycle steps", () => {
    expect(agoraStatusLabel("smart_wallet_approval_burn")).toBe(
      "Smart wallet approval / burn",
    );
    expect(agoraStatusLabel("finalize_bridge_deposit")).toBe(
      "MetaVault finalizing",
    );
    expect(agoraStatusLabel("waiting_to_be_deployed")).toBe(
      "Waiting to be deployed",
    );
  });
});
