"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
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

  const reload = async () => {
    invalidate();
    await refresh();
  };

  const togglePlan = async (plan: SubscriptionPlanOption) => {
    await updateSubscriptionPlanAction(plan.id, { active: !plan.active });
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
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl tracking-tight font-semibold">Plans</h1>
          <p className="text-[#171717]/70 text-sm mt-1 max-w-xl">
            Billing types and the modules each plan unlocks.
          </p>
        </div>
        <button
          className="btn-primary w-full sm:w-auto"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          + New plan
        </button>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Active plans" value={activeCount} />
        <StatCard label="Hidden plans" value={hiddenCount} />
        <StatCard label="Businesses on a plan" value={businessesOnPlan} />
      </div>

      {loadError ? <p role="alert" className="text-sm text-[#a12b1f] mb-4">{loadError}</p> : null}

      {!loadError && sorted.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-6 w-6" />}
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
              + New plan
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
      <span className="block text-xs uppercase tracking-wide text-[#171717]/60 font-medium">
        {label}
      </span>
      <span className="block text-2xl font-bold tabular-nums text-black mt-1">
        {value}
      </span>
    </div>
  );
}
