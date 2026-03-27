import { describe, it, expect } from "vitest";
import { buildTweetUrl } from "@/lib/utils";

describe("buildTweetUrl", () => {
  it("returns a Twitter intent URL", () => {
    const url = buildTweetUrl(45, "USDC");
    expect(url).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?text=/);
  });

  it("rounds APR to integer", () => {
    const url = buildTweetUrl(44.7, "ETH");
    expect(decodeURIComponent(url)).toContain("45%");
  });

  it("includes the asset symbol", () => {
    const url = buildTweetUrl(80, "cbBTC");
    expect(decodeURIComponent(url)).toContain("cbBTC");
  });

  it("includes @b1naryprotocol mention", () => {
    const url = buildTweetUrl(45, "USDC");
    expect(decodeURIComponent(url)).toContain("@b1naryprotocol");
  });

  it("includes b1nary.app link", () => {
    const url = buildTweetUrl(45, "USDC");
    expect(decodeURIComponent(url)).toContain("b1nary.app");
  });

  it("contains no emoji, hashtags, or 'options'", () => {
    const decoded = decodeURIComponent(buildTweetUrl(45, "USDC"));
    expect(decoded).not.toMatch(/#\w/);
    expect(decoded.toLowerCase()).not.toContain("option");
  });

  it("URL-encodes the tweet text", () => {
    const url = buildTweetUrl(45, "USDC");
    const textParam = url.split("text=")[1];
    expect(textParam).not.toContain(" ");
  });
});
