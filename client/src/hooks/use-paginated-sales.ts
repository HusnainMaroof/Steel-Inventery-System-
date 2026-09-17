"use client";

import { mapApiSale, type ApiBootstrap } from "@/lib/backend-adapters";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import type { Sale } from "@/lib/types";
import { useServerPaginated } from "./use-server-paginated";

/**
 * Server-paginated sales list — does not require full ledger hydration.
 */
export function usePaginatedSales(limit = DEFAULT_PAGE_SIZE) {
  const result = useServerPaginated<Sale>({
    path: "/sales",
    limit,
    mapItem: (raw) => mapApiSale(raw as ApiBootstrap["sales"][number]),
  });

  return {
    sales: result.items,
    loading: result.loading,
    error: result.error,
    page: result.page,
    setPage: result.setPage,
    total: result.total,
    totalPages: result.totalPages,
    limit: result.limit,
    refetch: result.refetch,
  };
}
