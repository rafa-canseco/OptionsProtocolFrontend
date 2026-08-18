import { ApiError, api, type PositionPortfolioStream } from "@/lib/api";
import {
  PositionPortfolioProtocolError,
  type PortfolioSourceKind,
} from "@/lib/positionPortfolioApi";

const SESSION_KEY = "b1nary_session_id";

export type PortfolioTelemetryOperation =
  | "mode_selected"
  | "active_complete"
  | "settled_page"
  | "delta_complete"
  | "legacy_fallback"
  | "request_failed";

export interface PortfolioTelemetryData {
  source_kind: PortfolioSourceKind;
  operation: PortfolioTelemetryOperation;
  stream?: PositionPortfolioStream | "snapshot";
  mode?: "bounded" | "legacy";
  page_count?: number;
  row_count?: number;
  duration_ms?: number;
  error_class?: "protocol" | "http" | "unknown";
  status?: number;
}

function sessionId(): string {
  if (typeof window === "undefined") return "server";
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

export function classifyPortfolioError(
  error: unknown,
): Pick<PortfolioTelemetryData, "error_class" | "status"> {
  if (error instanceof PositionPortfolioProtocolError) {
    return { error_class: "protocol" };
  }
  if (error instanceof ApiError) {
    return { error_class: "http", status: error.status };
  }
  return { error_class: "unknown" };
}

/**
 * Best-effort aggregate telemetry. The type intentionally has no fields for
 * subjects, addresses, IDs, cursors, payloads, or environment values.
 */
export function trackPortfolioEvent(data: PortfolioTelemetryData): void {
  try {
    const aggregateData: Record<string, unknown> = {
      source_kind: data.source_kind,
      operation: data.operation,
      ...(data.stream === undefined ? {} : { stream: data.stream }),
      ...(data.mode === undefined ? {} : { mode: data.mode }),
      ...(data.page_count === undefined ? {} : { page_count: data.page_count }),
      ...(data.row_count === undefined ? {} : { row_count: data.row_count }),
      ...(data.duration_ms === undefined ? {} : { duration_ms: data.duration_ms }),
      ...(data.error_class === undefined ? {} : { error_class: data.error_class }),
      ...(data.status === undefined ? {} : { status: data.status }),
    };
    const request = api.trackEvent?.({
      session_id: sessionId(),
      event_type: "portfolio_pagination",
      data: aggregateData,
    });
    void request?.catch(() => {
      // Analytics must never affect portfolio freshness or controls.
    });
  } catch {
    // Storage and analytics can be unavailable in privacy-focused browsers.
  }
}
