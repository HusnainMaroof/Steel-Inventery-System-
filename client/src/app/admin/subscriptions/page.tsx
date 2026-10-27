"use client";

import { useState } from "react";
import {
  updateSubscriptionPlanAction,
  type SubscriptionPlanOption,
} from "@/app/actions/platform";
import {
  SubscriptionPlanModal,
  SubscriptionPlanTable,
} from "@/components/admin/subscription-plans-ui";
import { AdminSubscriptionsSkeleton } from "@/components/skeletons";
import { usePlatformAdminData } from "@/hooks/use-platform-admin-data";
import { useAuth } from "@/lib/auth";
import { AdminPageHeader, StatGroup } from "@/components/admin/admin-ui";
import { EmptyState, Page } from "@/components/ui";

export default function AdminSubscriptionsPage() {
  const { user, ready } = useAuth();
  const {
    subscriptionPlans,
    owners,
    loading,
    loadError,
    refresh,
    invalidate,
  } = usePlatformAdminData(user?.role === "SUPERADMIN", {
    subscriptionPlans: true,
    owners: true,
    overview: false,
    templates: false,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPlanOption | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const reload = async () => {
    invalidate();
    await refresh();
  };

  const togglePlan = async (plan: SubscriptionPlanOption) => {
    setToggleError(null);
    const result = await updateSubscriptionPlanAction(plan.id, { active: !plan.active });
    if (!result.ok) {
      setToggleError(result.error);
      return;
    }
    await reload();
  };

  if (ready && user?.role !== "SUPERADMIN") return null;
  if (!ready || loading) return <AdminSubscriptionsSkeleton />;

  // Active plans first (by sortOrder), then hidden plans (by sortOrder).
  const sorted = [...subscriptionPlans].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });

  const activeCount = sorted.filter((p) => p.active).length;
  const hiddenCount = sorted.filter((p) => !p.active).length;
  const planIds = new Set(sorted.map((p) => p.id));
  const businessesOnPlan = owners.filter((o) => planIds.has(o.business.subscriptionPlanId ?? "")).length;

  return (
    <Page>
      <AdminPageHeader
        title="Plans"
        meta="Billing types and the modules each plan opens."
        actions={
          <button
            className="btn-primary w-full sm:w-auto"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            New plan
          </button>
        }
      />

      <div className="mb-8">
      <StatGroup
        columns={3}
        stats={[
          { label: "Active plans", value: activeCount },
          { label: "Hidden plans", value: hiddenCount },
          { label: "Businesses on a plan", value: businessesOnPlan },
        ]}
      />
      </div>

      {loadError ? <p role="alert" className="text-sm text-[#a12b1f] mb-4">{loadError}</p> : null}
      {toggleError ? <p role="alert" className="text-sm text-[#a12b1f] mb-4">{toggleError}</p> : null}

      {!loadError && sorted.length === 0 ? (
        <EmptyState
          title="No plans yet"
          hint="Create a plan to start registering businesses."
          action={
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              New plan
            </button>
          }
        />
      ) : (
        <SubscriptionPlanTable
          plans={sorted}
          onEdit={(plan) => {
            setEditing(plan);
            setModalOpen(true);
          }}
          onToggle={togglePlan}
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
