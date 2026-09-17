"use client";

import { useState } from "react";
import {
  removeOwnerAction,
  updateOwnerAction,
  type OwnerAccount,
} from "@/app/actions/users";
import {
  AddOwnerModal,
  BusinessAccountCard,
  planLabel,
  ResetPasswordModal,
  SubscriptionModal,
  TemplatesModal,
} from "@/components/admin/admin-ui";
import { AdminBusinessesSkeleton } from "@/components/skeletons";
import { usePlatformAdminData } from "@/hooks/use-platform-admin-data";
import { useAuth } from "@/lib/auth";
import { EmptyState, Page } from "@/components/ui";

export default function AdminBusinessesPage() {
  const { user, ready } = useAuth();
  const {
    owners,
    overview,
    templates,
    loading,
    loadError,
    refresh,
    invalidate,
  } = usePlatformAdminData(user?.role === "SUPERADMIN");
  const [addOpen, setAddOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [resetOwner, setResetOwner] = useState<OwnerAccount | null>(null);
  const [subOwner, setSubOwner] = useState<OwnerAccount | null>(null);
  const [templateOwner, setTemplateOwner] = useState<OwnerAccount | null>(null);

  const reload = async () => {
    invalidate();
    await refresh();
  };

  if (ready && user?.role !== "SUPERADMIN") return null;
  if (!ready || (loading && owners.length === 0)) return <AdminBusinessesSkeleton />;

  const revoke = async (id: string) => {
    setRemovingId(id);
    const result = await removeOwnerAction(id);
    setRemovingId(null);
    if (!result.ok) return;
    await reload();
  };

  const reactivate = async (id: string) => {
    setReactivatingId(id);
    const result = await updateOwnerAction(id, { active: true });
    setReactivatingId(null);
    if (!result.ok) return;
    await reload();
  };

  const templateMap = new Map(templates.map((t) => [t.id, t.label]));

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl tracking-tight font-semibold">Businesses & accounts</h1>
          <p className="text-[#171717]/70 text-xs mt-1">
            Manage owner logins, subscriptions, and product templates.
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
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-neutral-500 px-0.5">
            {owners.length} business{owners.length === 1 ? "" : "es"} ·{" "}
            {owners.filter((o) => o.active).length} active login
            {owners.filter((o) => o.active).length === 1 ? "" : "s"}
          </p>

          <div className="grid gap-3">
            {owners.map((owner) => {
              const biz = overview?.businesses.find((b) => b.ownerId === owner.id);
              const subActive =
                biz?.subscriptionActive ??
                (owner.business.subscriptionStatus === "ACTIVE");
              const templateIds = owner.business.assignedTemplateIds ?? [];

              return (
                <BusinessAccountCard
                  key={owner.id}
                  owner={owner}
                  subActive={subActive}
                  activity={biz?.activity30d}
                  planLabel={planLabel(owner.business.subscriptionPlan)}
                  templateTags={
                    templateIds.length
                      ? templateIds.map((id) => templateMap.get(id) ?? id)
                      : []
                  }
                  onSubscription={() => setSubOwner(owner)}
                  onTemplates={() => setTemplateOwner(owner)}
                  onResetPassword={() => setResetOwner(owner)}
                  onRevoke={() => void revoke(owner.id)}
                  onReactivate={() => void reactivate(owner.id)}
                  revoking={removingId === owner.id}
                  reactivating={reactivatingId === owner.id}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      <AddOwnerModal
        open={addOpen}
        templates={templates}
        onClose={() => setAddOpen(false)}
        onCreated={reload}
      />
      <ResetPasswordModal owner={resetOwner} onClose={() => setResetOwner(null)} onUpdated={reload} />
      <SubscriptionModal owner={subOwner} onClose={() => setSubOwner(null)} onUpdated={reload} />
      <TemplatesModal
        owner={templateOwner}
        templates={templates}
        onClose={() => setTemplateOwner(null)}
        onUpdated={reload}
      />
    </Page>
  );
}
