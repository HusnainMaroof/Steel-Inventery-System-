"use client";

import { AdminOverviewDashboard } from "@/components/admin/admin-overview";
import { AdminOverviewSkeleton } from "@/components/skeletons";
import { usePlatformAdminData } from "@/hooks/use-platform-admin-data";
import { useAuth } from "@/lib/auth";
import { Page } from "@/components/ui";

export default function AdminOverviewPage() {
  const { user, ready } = useAuth();
  const { overview, loading, loadError } = usePlatformAdminData(
    user?.role === "SUPERADMIN",
    { overview: true, owners: false, templates: false, subscriptionPlans: false },
  );

  if (ready && user?.role !== "SUPERADMIN") return null;
  if (!ready || (loading && !overview)) return <AdminOverviewSkeleton />;

  return (
    <Page>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl tracking-tight font-semibold">Overview</h1>
        <p className="text-[#171717]/70 text-xs mt-1 max-w-2xl">
          Platform health, subscriptions, and every business in one place — without noise from tenant ledgers.
        </p>
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-[#a12b1f] mb-4">
          {loadError}
        </p>
      ) : null}

      {overview ? <AdminOverviewDashboard overview={overview} /> : null}
    </Page>
  );
}
