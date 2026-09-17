"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { useStore } from "@/lib/store";

/**
 * Client-side invoice pagination from the ledger store.
 * Data is loaded once via bootstrap — switching tabs does not refetch.
 */
export function usePaginatedSales(limit = DEFAULT_PAGE_SIZE) {
  const { sales, ready } = useStore();
  const [page, setPage] = useState(1);

  const total = sales.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const pageSales = useMemo(() => {
    const start = (page - 1) * limit;
    return sales.slice(start, start + limit);
  }, [sales, page, limit]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return {
    sales: pageSales,
    loading: !ready,
    error: null as string | null,
    page,
    setPage,
    total,
    totalPages,
    limit,
    refetch: async () => {},
  };
}
