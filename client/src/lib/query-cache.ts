/** Tiny in-memory cache for client fetches — invalidated when ledger dataVersion bumps */

type CacheEntry<T> = { data: T; version: number };

const caches = new Map<string, CacheEntry<unknown>>();

export function readCache<T>(key: string, version: number): T | null {
  const hit = caches.get(key);
  if (!hit || hit.version !== version) return null;
  return hit.data as T;
}

export function writeCache<T>(key: string, version: number, data: T) {
  caches.set(key, { data, version });
}

export function clearCache(prefix?: string) {
  if (!prefix) {
    caches.clear();
    return;
  }
  for (const key of caches.keys()) {
    if (key.startsWith(prefix)) caches.delete(key);
  }
}
