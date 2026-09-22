"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { skeletonForPath } from "@/components/skeletons";
import { ErrorState } from "@/components/ui";

/**
 * Blocks tenant page content until the ledger bootstrap AND the full
 * transaction data have both finished loading (first load only — later
 * refreshes never re-trigger the skeleton).
 * Shell (sidebar) stays visible; only the main area shows a skeleton or error.
 */
export default function StoreGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const { user, ready: authReady } = useAuth();
  const { ready: storeReady, dataReady, error, retry } = useStore();

  const isTenantUser = user && user.role !== "SUPERADMIN";
  const waiting =
    (!authReady && Boolean(pathname) && !pathname.startsWith("/admin")) ||
    (authReady && isTenantUser && (!storeReady || !dataReady) && !error);
  const failed = authReady && isTenantUser && (!storeReady || !dataReady) && !!error;

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
