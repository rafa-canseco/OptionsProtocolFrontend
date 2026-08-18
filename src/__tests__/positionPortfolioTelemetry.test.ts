import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "@/lib/api";
import {
  classifyPortfolioError,
  trackPortfolioEvent,
} from "@/lib/positionPortfolioTelemetry";

describe("position portfolio telemetry privacy", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("emits only whitelisted aggregate fields", () => {
    const track = vi.spyOn(api, "trackEvent").mockResolvedValue({ ok: true });

    trackPortfolioEvent({
      source_kind: "wallet_batch",
      operation: "delta_complete",
      stream: "changes",
      page_count: 2,
      row_count: 101,
      duration_ms: 12,
      ...({
        address: "must-not-leak",
        cursor: "must-not-leak",
        payload: "must-not-leak",
      } as object),
    });

    const event = track.mock.calls[0][0];
    expect(event.event_type).toBe("portfolio_pagination");
    expect(event.data).toEqual({
      source_kind: "wallet_batch",
      operation: "delta_complete",
      stream: "changes",
      page_count: 2,
      row_count: 101,
      duration_ms: 12,
    });
    const serialized = JSON.stringify(event.data);
    expect(serialized).not.toMatch(/address|user.?id|cursor|payload|secret|environment/i);
  });

  it("classifies request failures without forwarding error messages", () => {
    const classification = classifyPortfolioError(
      new ApiError(503, { message: "response may contain private context" }),
    );

    expect(classification).toEqual({ error_class: "http", status: 503 });
    expect(JSON.stringify(classification)).not.toContain("private context");
  });
});
