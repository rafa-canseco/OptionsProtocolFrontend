import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/contracts", () => ({
  publicClient: {},
  ADDRESSES: {},
  ERC20_ABI: [],
  BATCH_SETTLER_ABI: [],
}));

const { fireAndPoll } = await import("@/lib/execution");

describe("fireAndPoll", () => {
  it("does not treat a wallet hash as on-chain confirmation", async () => {
    vi.useFakeTimers();
    const check = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const result = fireAndPoll(
      () => Promise.resolve("0xhash-fast"),
      check,
      "test-fast",
    );
    let settled = false;
    void result.then(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toBe("0xhash-fast");
    expect(check).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("keeps on-chain confirmation authoritative after a wallet transport error", async () => {
    vi.useFakeTimers();
    const check = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const result = fireAndPoll(
      () => Promise.reject(new Error("wallet transport disconnected")),
      check,
      "test-wallet-error",
    );

    await vi.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toBeNull();
    expect(check).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
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
