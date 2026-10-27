"use client";

import { AdminOverviewDashboard } from "@/components/admin/admin-overview";
import { AdminOverviewSkeleton } from "@/components/skeletons";
import { usePlatformAdminData } from "@/hooks/use-platform-admin-data";
import { useAuth } from "@/lib/auth";
import { Page } from "@/components/ui";
import { AdminPageHeader } from "@/components/admin/admin-ui";

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
      <AdminPageHeader title="Overview" meta="Every business on Tijartt, at a glance." />

      {loadError ? (
        <p role="alert" className="text-sm text-[#a12b1f] mb-4">
          {loadError}
        </p>
      ) : null}

      {overview ? <AdminOverviewDashboard overview={overview} /> : null}
    </Page>
  );
}
