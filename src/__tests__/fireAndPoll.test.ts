import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/contracts", () => ({
  publicClient: {},
  ADDRESSES: {},
  ERC20_ABI: [],
  BATCH_SETTLER_ABI: [],
}));

const { fireAndPoll } = await import("@/lib/execution");

describe("fireAndPoll", () => {
  it("returns the tx hash when the wallet response wins the race", async () => {
    const fire = () => Promise.resolve("0xhash-fast");
    const check = vi.fn().mockResolvedValue(true);

    const hash = await fireAndPoll(fire, check, "test-fast");

    expect(hash).toBe("0xhash-fast");
  });

  it("waits for the tx hash within the grace window when the on-chain poll wins", async () => {
    // poll resolves immediately; fire resolves shortly after — grace
    // window must allow hash capture so downstream tagging doesn't skip
    const fire = () =>
      new Promise<string>((resolve) =>
        setTimeout(() => resolve("0xhash-late"), 200),
      );
    const check = () => Promise.resolve(true);

    const hash = await fireAndPoll(fire, check, "test-poll-wins");

    expect(hash).toBe("0xhash-late");
  });

});
