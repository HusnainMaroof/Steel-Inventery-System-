"use client";

import { useState } from "react";
import { AddOwnerModal, BusinessListTable, planLabel } from "@/components/admin/admin-ui";
import { AdminBusinessesSkeleton } from "@/components/skeletons";
import { usePlatformAdminData } from "@/hooks/use-platform-admin-data";
import { useAuth } from "@/lib/auth";
import { EmptyState, Page } from "@/components/ui";

export default function AdminBusinessesPage() {
  const { user, ready } = useAuth();
  const { owners, templates, subscriptionPlans, loading, loadError, refresh, invalidate } =
    usePlatformAdminData(user?.role === "SUPERADMIN", {
      owners: true,
      templates: true,
      subscriptionPlans: true,
      overview: false,
    });
  const [addOpen, setAddOpen] = useState(false);

  const reload = async () => {
    invalidate();
    await refresh();
  };

  if (ready && user?.role !== "SUPERADMIN") return null;
  if (!ready || (loading && owners.length === 0)) return <AdminBusinessesSkeleton />;

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl tracking-tight font-semibold">Businesses</h1>
          <p className="text-[#171717]/70 text-xs mt-1">
            All registered businesses — open a row to manage subscription, templates, and login.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          + Register business owner
        </button>
      </div>

      {loadError && (
        <p role="alert" className="text-sm text-[#a12b1f] mb-4">{loadError}</p>
      )}

      {!loading && owners.length === 0 && !loadError ? (
        <div className="panel">
          <EmptyState
            emoji="🏪"
            title="No businesses yet"
            hint="Register the first business owner and assign a subscription plan and product templates."
            action={<button className="btn-primary" onClick={() => setAddOpen(true)}>+ Register business owner</button>}
          />
        </div>
      ) : owners.length > 0 ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.1em] text-neutral-500 mb-3 px-0.5">
            {owners.length} business{owners.length === 1 ? "" : "es"}
          </p>
          <BusinessListTable owners={owners} planFor={(owner) => planLabel(owner.business)} />
        </>
      ) : null}

      <AddOwnerModal
        open={addOpen}
        templates={templates}
        subscriptionPlans={subscriptionPlans}
        onClose={() => setAddOpen(false)}
        onCreated={reload}
      />
    </Page>
  );
}
