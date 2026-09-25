"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { businessPath } from "@/lib/business-path";
import RouteSkeleton from "@/components/RouteSkeleton";

/** Old single-segment URLs (/reports) → /{businessSlug}/reports */
export default function LegacyTenantPageRedirect({ page }: { page: string }) {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user || user.role === "SUPERADMIN") {
      router.replace("/login");
      return;
    }
    router.replace(businessPath(user.businessSlug, page));
  }, [ready, user, router, page]);

  return <RouteSkeleton />;
}
