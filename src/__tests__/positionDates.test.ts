import { describe, expect, it } from "vitest";
import {
  formatPositionDate,
  formatPositionTerm,
  getPositionExpiryDate,
  getPositionOpenedDate,
  getPositionTermDays,
} from "@/lib/positionDates";

describe("position date helpers", () => {
  it("uses calendar dates for the displayed term, not full 24h blocks", () => {
    const openedAt = "2026-05-08T18:30:00.000Z";
    const expiresAt = Date.UTC(2026, 4, 10) / 1000;

    expect(getPositionTermDays(openedAt, expiresAt)).toBe(2);
  });

  it("prefers the on-chain block time when available", () => {
    const indexedAt = "2026-05-08T18:30:00.000Z";
    const blockTimestamp = Date.UTC(2026, 4, 9, 12) / 1000;

    expect(getPositionOpenedDate(indexedAt, blockTimestamp).getTime()).toBe(
      blockTimestamp * 1000,
    );
    expect(
      getPositionTermDays(indexedAt, Date.UTC(2026, 4, 10) / 1000, blockTimestamp),
    ).toBe(1);
  });

  it("formats the expiry timestamp as the contract expiry date", () => {
    const expiresAt = Date.UTC(2026, 4, 10) / 1000;

    expect(formatPositionDate(getPositionExpiryDate(expiresAt))).toBe("May 10");
    expect(formatPositionTerm(2)).toBe("2 days");
    expect(formatPositionTerm(1)).toBe("1 day");
  });
});
