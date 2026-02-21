"use client";

import { useRef, useCallback } from "react";

const DEBOUNCE_MS = 500;

function getSessionId(): string {
  const key = "b1nary_session_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function useSliderAnalytics() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const track = useCallback((eventType: string, data: Record<string, unknown>) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const event = {
        session_id: getSessionId(),
        event_type: eventType,
        timestamp: new Date().toISOString(),
        ...data,
      };

      // TODO: replace with api.trackEvent() when B1N-5 ships
      if (process.env.NODE_ENV === "development") {
        console.log("[analytics]", event);
      }
    }, DEBOUNCE_MS);
  }, []);

  const trackSliderUse = useCallback(
    (selectedPrice: number, side: "buy" | "sell") => {
      track("slider_use", { selected_price: selectedPrice, side });
    },
    [track],
  );

  return { trackSliderUse };
}
