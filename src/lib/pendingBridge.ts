const KEY = "b1nary:pending-bridge";
const EVENT = "b1nary:pending-bridge";

export interface PendingBridge {
  message: string;
  jobId?: string;
  txHash?: string;
  quoteId?: string | null;
  updatedAt: number;
}

export function savePendingBridge(update: Omit<PendingBridge, "updatedAt">) {
  if (typeof window === "undefined") return;
  const item: PendingBridge = { ...update, updatedAt: Date.now() };
  sessionStorage.setItem(KEY, JSON.stringify(item));
  window.dispatchEvent(new Event(EVENT));
}

export function readPendingBridge(): PendingBridge | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingBridge) : null;
  } catch {
    return null;
  }
}

export function clearPendingBridge() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function subscribePendingBridge(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
