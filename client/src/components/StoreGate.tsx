"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { skeletonForPath } from "@/components/skeletons";
import { ErrorState } from "@/components/ui";
import { pagePathFromBusinessRoute } from "@/lib/business-path";

/**
 * Pages that read only catalogue, settings or staff from the store. All of it
 * comes from the bootstrap, so they render without waiting for transactions.
 * The dashboard gets its figures from the server report, not from the store.
 */
const CATALOGUE_ONLY_PAGES = new Set(["/dashboard", "/staff", "/settings"]);

/**
 * Blocks tenant page content until the ledger bootstrap and, for pages that
 * use them, the full transaction data have finished loading (first load
 * only — later refreshes never re-trigger the skeleton).
 * Shell (sidebar) stays visible; only the main area shows a skeleton or error.
 */
export default function StoreGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const { user, ready: authReady } = useAuth();
  const { ready: storeReady, dataReady, error, retry } = useStore();

  const needsTransactions = !CATALOGUE_ONLY_PAGES.has(pagePathFromBusinessRoute(pathname) ?? "");
  const loaded = storeReady && (dataReady || !needsTransactions);
  const isTenantUser = user && user.role !== "SUPERADMIN";
  const waiting =
    (!authReady && Boolean(pathname) && !pathname.startsWith("/admin")) ||
    (authReady && isTenantUser && !loaded && !error);
  const failed = authReady && isTenantUser && !loaded && !!error;

  if (waiting) {
    return skeletonForPath(pathname);
  }

  if (failed) {
    return (
      <ErrorState
        title="Could not load your ledger"
        message={error}
        onRetry={retry}
      />
    );
  }

  return <>{children}</>;
}
