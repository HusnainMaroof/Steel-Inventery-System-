"use client";

import { mapApiSale, type ApiBootstrap } from "@/lib/backend-adapters";
import { businessSlugFromPath, pagePathFromBusinessRoute } from "@/lib/business-path";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import type { Sale } from "@/lib/types";
import { startEarlyPage, useServerPaginated } from "./use-server-paginated";

// On a full load of the sales page, page 1 starts with the bootstrap instead of
// after the gated page mounts. The hook adopts it once (see startEarlyPage).
if (typeof window !== "undefined") {
  const { pathname } = window.location;
  if (businessSlugFromPath(pathname) && pagePathFromBusinessRoute(pathname) === "/sales") {
    startEarlyPage("/sales", DEFAULT_PAGE_SIZE);
  }
}

const mapSale = (raw: unknown) => mapApiSale(raw as ApiBootstrap["sales"][number]);

/**
 * Server-paginated sales list — does not require full ledger hydration.
 */
export function usePaginatedSales(limit = DEFAULT_PAGE_SIZE) {
  const result = useServerPaginated<Sale>({
    path: "/sales",
    limit,
    mapItem: mapSale,
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
