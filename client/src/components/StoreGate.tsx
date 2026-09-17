"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { skeletonForPath } from "@/components/skeletons";
import { ErrorState } from "@/components/ui";

/**
 * Blocks tenant page content until the ledger bootstrap finishes.
 * Shell (sidebar) stays visible; only the main area shows a skeleton or error.
 */
export default function StoreGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const { user, ready: authReady } = useAuth();
  const { ready: storeReady, error, retry } = useStore();

  const isTenantUser = user && user.role !== "SUPERADMIN";
  const waiting =
    (!authReady && Boolean(pathname) && !pathname.startsWith("/admin")) ||
    (authReady && isTenantUser && !storeReady && !error);
  const failed = authReady && isTenantUser && !storeReady && !!error;

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
