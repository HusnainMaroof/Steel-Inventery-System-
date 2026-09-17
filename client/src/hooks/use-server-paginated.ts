"use client";

import { useCallback, useEffect, useState } from "react";
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

export function useServerPaginated<T>({
  path,
  limit = DEFAULT_PAGE_SIZE,
  mapItem = (raw) => raw as T,
  enabled = true,
}: Options<T>) {
  const { ready, dataVersion } = useStore();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async () => {
    if (!enabled || !ready) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<Paginated<unknown>>(
        `${path}?page=${page}&limit=${limit}`,
      );
      setItems(res.items.map(mapItem));
      setTotal(res.total);
      setTotalPages(res.pages);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [enabled, ready, path, page, limit, mapItem]);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage, dataVersion]);

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
