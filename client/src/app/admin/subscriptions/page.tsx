"use client";

import { useState } from "react";
import type { SubscriptionPlanOption } from "@/app/actions/platform";
import {
  SubscriptionPlanModal,
  SubscriptionPlanTable,
} from "@/components/admin/subscription-plans-ui";
import { AdminSubscriptionsSkeleton } from "@/components/skeletons";
import { usePlatformAdminData } from "@/hooks/use-platform-admin-data";
import { useAuth } from "@/lib/auth";
import { EmptyState, Page } from "@/components/ui";

export default function AdminSubscriptionsPage() {
  const { user, ready } = useAuth();
  const { subscriptionPlans, loading, loadError, refresh, invalidate } = usePlatformAdminData(
    user?.role === "SUPERADMIN",
    { subscriptionPlans: true, owners: false, overview: false, templates: false },
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPlanOption | null>(null);

  const reload = async () => {
    invalidate();
    await refresh();
  };

  if (ready && user?.role !== "SUPERADMIN") return null;
  if (!ready || loading) return <AdminSubscriptionsSkeleton />;

  const sorted = [...subscriptionPlans].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl tracking-tight font-semibold">Subscriptions</h1>
          <p className="text-[#171717]/70 text-xs mt-1">
            Create and manage plans — business owners are assigned one of these when you register them.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          + New plan
        </button>
      </div>

      {loadError ? <p role="alert" className="text-sm text-[#a12b1f] mb-4">{loadError}</p> : null}

      {!loadError && sorted.length === 0 ? (
        <div className="panel">
          <EmptyState
            emoji="💳"
            title="No subscription plans"
            hint="Add monthly, yearly, lifetime, or custom-duration plans for your businesses."
            action={
              <button
                className="btn-primary"
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                + New plan
              </button>
            }
          />
        </div>
      ) : (
        <SubscriptionPlanTable
          plans={sorted}
          onEdit={(plan) => {
            setEditing(plan);
            setModalOpen(true);
          }}
        />
      )}

      <SubscriptionPlanModal
        open={modalOpen}
        plan={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSaved={reload}
      />
    </Page>
  );
}
