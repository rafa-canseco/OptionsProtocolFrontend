export type DataScope =
  | "balances"
  | "positions"
  | "activity"
  | "yield"
  | "vault";

const DATA_INVALIDATION_EVENT = "b1nary:data-invalidate";
const LEGACY_BALANCE_EVENT = "balance:refetch";
const invalidatedAt = new Map<DataScope, number>();
const bridgedLegacyEvents = new WeakSet<Event>();
const legacyRefreshScopes = new Set<DataScope>([
  "positions",
  "activity",
  "yield",
]);

type DataInvalidationDetail = {
  scopes: DataScope[];
  reason?: string;
};

export function invalidateData(scopes: DataScope[], reason?: string): void {
  if (typeof window === "undefined") return;
  const uniqueScopes = Array.from(new Set(scopes));
  const now = Date.now();
  for (const scope of uniqueScopes) invalidatedAt.set(scope, now);
  if (uniqueScopes.includes("balances")) {
    // Keep the existing balance refresh contract for the EVM and Solana hooks.
    const event = new Event(LEGACY_BALANCE_EVENT);
    bridgedLegacyEvents.add(event);
    window.dispatchEvent(event);
  }
  window.dispatchEvent(
    new CustomEvent<DataInvalidationDetail>(DATA_INVALIDATION_EVENT, {
      detail: { scopes: uniqueScopes, reason },
    }),
  );
}

export function wasDataInvalidatedRecently(
  scope: DataScope,
  withinMs: number,
): boolean {
  const timestamp = invalidatedAt.get(scope);
  return timestamp !== undefined && Date.now() - timestamp <= withinMs;
}

export function clearDataInvalidations(): void {
  invalidatedAt.clear();
}

export function subscribeDataInvalidation(
  scope: DataScope,
  callback: (reason?: string) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<DataInvalidationDetail>).detail;
    if (detail?.scopes.includes(scope)) callback(detail.reason);
  };
  const legacyHandler = (event: Event) => {
    if (bridgedLegacyEvents.has(event)) return;
    if (legacyRefreshScopes.has(scope)) callback("legacy-balance-refetch");
  };
  window.addEventListener(DATA_INVALIDATION_EVENT, handler);
  window.addEventListener(LEGACY_BALANCE_EVENT, legacyHandler);
  return () => {
    window.removeEventListener(DATA_INVALIDATION_EVENT, handler);
    window.removeEventListener(LEGACY_BALANCE_EVENT, legacyHandler);
  };
}
