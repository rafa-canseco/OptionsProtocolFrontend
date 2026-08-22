import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";

afterEach(() => vi.unstubAllGlobals());

describe("fund freshness API", () => {
  it("sends post-transaction generation, block, and equal-height hash bounds", async () => {
    const wire = {
      generation: 8,
      as_of_block: 123,
      as_of_block_hash: `0x${"a".repeat(64)}`,
      published_at: "2026-08-22T00:00:30Z",
      stale: false,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...wire }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const freshness = {
      minGeneration: 8,
      minBlock: 123,
      minBlockHash: `0x${"a".repeat(64)}`,
    };

    const summary = await api.getFund("base:csp", freshness);
    await api.getFundPosition("base:csp", "0xabc", freshness);

    expect(summary).toMatchObject({
      ...wire,
      asOfBlock: wire.as_of_block,
      asOfBlockHash: wire.as_of_block_hash,
      publishedAt: wire.published_at,
    });

    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toContain("min_generation=8");
      expect(url).toContain("min_block=123");
      expect(url).toContain(`min_block_hash=${freshness.minBlockHash}`);
      expect(init).toMatchObject({ cache: "no-store" });
    }
  });
});
