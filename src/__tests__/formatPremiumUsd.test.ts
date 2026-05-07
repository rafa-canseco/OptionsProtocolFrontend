import { describe, expect, it } from "vitest";
import { fmtPremiumUsd } from "@/lib/utils";

describe("fmtPremiumUsd", () => {
  it("does not round tiny positive premiums down to zero", () => {
    expect(fmtPremiumUsd(0.0013)).toBe("<$0.01");
  });

  it("keeps standard dollar formatting for cent-sized premiums", () => {
    expect(fmtPremiumUsd(0.01)).toBe("$0.01");
    expect(fmtPremiumUsd(12.34)).toBe("$12.34");
  });
});
