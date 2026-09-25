"use client";

import { useCallback, useEffect, useState } from "react";
import { userFacingError } from "@/lib/user-error";
import { apiFetch } from "@/lib/api";
import type { Paginated } from "@/lib/pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { useStore } from "@/lib/store";

type Options<T> = {
  path: string;
  limit?: number;
  mapItem?: (raw: unknown) => T;
  enabled?: boolean;
};

/* Module-level so the default `mapItem` keeps a stable identity across renders. */
function identity<T>(raw: unknown): T {
  return raw as T;
}

type CacheEntry<T> = {
  items: T[];
  total: number;
  pages: number;
  /** Store dataVersion at fetch time — a bump means the entry is stale. */
  dataVersion: number;
};

/**
 * Module-level page cache. Keeps fetched pages alive across route changes so
 * revisiting a page renders instantly instead of refetching. Entries are
 * invalidated when the store's dataVersion bumps (any ledger mutation) or on
 * a full page reload.
 */
const pageCache = new Map<string, CacheEntry<unknown>>();

/**
 * In-flight fetches keyed by page + dataVersion. React Strict Mode runs every
 * effect twice on mount — without this, each mount fired the same request
 * twice before either could populate the cache.
 */
const inFlightPages = new Map<string, Promise<void>>();

export function useServerPaginated<T>({
  path,
  limit = DEFAULT_PAGE_SIZE,
  mapItem = identity,
  enabled = true,
}: Options<T>) {
  const { ready, dataVersion } = useStore();
  const [page, setPage] = useState(1);
  const cacheKey = `${path}?page=${page}&limit=${limit}`;
  // Lazy state init: a cached page mounts with its data and no spinner.
  const cached = pageCache.get(cacheKey) as CacheEntry<T> | undefined;
  const [items, setItems] = useState<T[]>(cached?.items ?? []);
  const [total, setTotal] = useState(cached?.total ?? 0);
  const [totalPages, setTotalPages] = useState(cached?.pages ?? 1);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async () => {
    if (!enabled || !ready) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<Paginated<unknown>>(
        `${path}?page=${page}&limit=${limit}`,
      );
      const mapped = res.items.map(mapItem);
      pageCache.set(cacheKey, {
        items: mapped,
        total: res.total,
        pages: res.pages,
        dataVersion,
      });
      setItems(mapped);
      setTotal(res.total);
      setTotalPages(res.pages);
    } catch (reason) {
      setError(userFacingError(reason, "Failed to load data"));
    } finally {
      setLoading(false);
    }
  }, [enabled, ready, path, page, limit, mapItem, dataVersion, cacheKey]);

  useEffect(() => {
    const applyCache = () => {
      const hit = pageCache.get(cacheKey) as CacheEntry<T> | undefined;
      if (!hit) return false;
      setItems(hit.items);
      setTotal(hit.total);
      setTotalPages(hit.pages);
      setLoading(false);
      return true;
    };

    if (applyCache()) return;

    const flightKey = `${cacheKey}|${dataVersion}`;
    const pending = inFlightPages.get(flightKey);
    if (pending) {
      // Another instance is already fetching this exact page — adopt its
      // result. (The component may have remounted; the original fetch's
      // setState calls belong to a dead instance, so without this the fresh
      // mount would stay on its skeleton forever.)
      void pending.then(() => {
        // If the adopted fetch failed (no cache entry), refetch here so this
        // instance still surfaces data or an error.
        if (!applyCache()) void fetchPage();
      });
      return;
    }
    const task = fetchPage().finally(() => {
      inFlightPages.delete(flightKey);
    });
    inFlightPages.set(flightKey, task);
  }, [fetchPage, dataVersion, cacheKey]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return {
    items,
    loading: !ready || loading,
    error,
    page,
    setPage,
    total,
    totalPages,
    limit,
    refetch: fetchPage,
  };
}
