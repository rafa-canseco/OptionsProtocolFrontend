type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  inFlight?: Promise<T>;
};

const requestCache = new Map<string, CacheEntry<unknown>>();

export async function sharedRequest<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const existing = requestCache.get(key) as CacheEntry<T> | undefined;
  if (existing?.value !== undefined && existing.expiresAt > now) {
    return existing.value;
  }
  if (existing?.inFlight) return existing.inFlight;

  const entry: CacheEntry<T> = existing ?? { expiresAt: 0 };
  const request = load()
    .then((value) => {
      entry.value = value;
      entry.expiresAt = Date.now() + ttlMs;
      return value;
    })
    .finally(() => {
      delete entry.inFlight;
    });
  entry.inFlight = request;
  requestCache.set(key, entry as CacheEntry<unknown>);
  return request;
}

export function invalidateSharedRequest(key: string): void {
  requestCache.delete(key);
}

export function clearSharedRequests(): void {
  requestCache.clear();
}
