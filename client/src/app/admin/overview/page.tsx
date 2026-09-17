"use client";

import { fmtDate, StatCard } from "@/components/admin/admin-ui";
import { AdminOverviewSkeleton } from "@/components/skeletons";
import { usePlatformAdminData } from "@/hooks/use-platform-admin-data";
import { useAuth } from "@/lib/auth";
import { Page } from "@/components/ui";

export default function AdminOverviewPage() {
  const { user, ready } = useAuth();
  const { overview, loading, loadError } = usePlatformAdminData(
    user?.role === "SUPERADMIN",
    { overview: true, owners: false, templates: false },
  );

  if (ready && user?.role !== "SUPERADMIN") return null;
  if (!ready || (loading && !overview)) return <AdminOverviewSkeleton />;

  const totals = overview?.totals;

  return (
    <Page>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl tracking-tight font-semibold">Overview</h1>
        <p className="text-[#171717]/70 text-xs mt-1">
          Platform-wide stats, subscriptions, and recent activity.
        </p>
      </div>

      {loadError && (
        <p role="alert" className="text-sm text-[#a12b1f] mb-4">{loadError}</p>
      )}

      {overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Businesses" value={totals?.businesses ?? 0} />
            <StatCard label="Active owners" value={totals?.activeOwners ?? 0} />
            <StatCard label="Active subscriptions" value={overview.subscriptions.active} />
            <StatCard label="Expired subscriptions" value={overview.subscriptions.expired} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <StatCard label="Sales (30 days)" value={totals?.sales30d ?? 0} hint="Across all tenants" />
            <StatCard label="Purchases (30 days)" value={totals?.purchases30d ?? 0} hint="Across all tenants" />
            <StatCard label="Payments (30 days)" value={totals?.payments30d ?? 0} hint="Across all tenants" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="panel p-4">
              <h2 className="text-sm font-semibold mb-3">Subscription mix</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-neutral-500">Monthly</dt><dd className="font-semibold tabular-nums">{overview.subscriptions.monthly}</dd></div>
                <div><dt className="text-neutral-500">Yearly</dt><dd className="font-semibold tabular-nums">{overview.subscriptions.yearly}</dd></div>
                <div><dt className="text-neutral-500">Lifetime</dt><dd className="font-semibold tabular-nums">{overview.subscriptions.lifetime}</dd></div>
                <div><dt className="text-neutral-500">Revoked logins</dt><dd className="font-semibold tabular-nums">{totals?.revokedOwners ?? 0}</dd></div>
              </dl>
            </div>

            <div className="panel p-4">
              <h2 className="text-sm font-semibold mb-3">Recent activity</h2>
              {overview.recentActivity.length === 0 ? (
                <p className="text-sm text-neutral-500">No sales or purchases yet.</p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {overview.recentActivity.map((item, i) => (
                    <li key={`${item.type}-${item.at}-${i}`} className="text-sm border-b border-neutral-100 pb-2 last:border-0">
                      <span className="font-medium">{item.businessName}</span>
                      <span className="text-neutral-400"> · </span>
                      <span>{item.type === "sale" ? "Sale" : "Purchase"}</span>
                      <span className="text-neutral-400"> · </span>
                      <span>{item.label}</span>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {item.party} · {fmtDate(item.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
