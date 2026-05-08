import { describe, expect, it } from "vitest";
import {
  formatPositionDate,
  formatPositionTerm,
  getPositionExpiryDate,
  getPositionTermDays,
} from "@/lib/positionDates";

describe("position date helpers", () => {
  it("uses calendar dates for the displayed term, not full 24h blocks", () => {
    const openedAt = "2026-05-08T18:30:00.000Z";
    const expiresAt = Date.UTC(2026, 4, 10) / 1000;

    expect(getPositionTermDays(openedAt, expiresAt)).toBe(2);
  });

  it("formats the expiry timestamp as the contract expiry date", () => {
    const expiresAt = Date.UTC(2026, 4, 10) / 1000;

    expect(formatPositionDate(getPositionExpiryDate(expiresAt))).toBe("May 10");
    expect(formatPositionTerm(2)).toBe("2 days");
    expect(formatPositionTerm(1)).toBe("1 day");
  });
});
