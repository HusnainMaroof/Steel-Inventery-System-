"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  listProductTemplatesAction,
  listSubscriptionPlansAction,
  type ProductTemplateOption,
  type SubscriptionPlanOption,
} from "@/app/actions/platform";
import {
  deleteOwnerAction,
  getOwnerAction,
  updateOwnerAction,
  type OwnerAccount,
} from "@/app/actions/users";
import {
  DetailRow,
  fmtDate,
  isLifetimeBusiness,
  planLabel,
  ResetPasswordModal,
  StatusBadge,
  SubBadge,
  SubscriptionModal,
  TemplatesModal,
} from "@/components/admin/admin-ui";
import { AdminBusinessDetailSkeleton } from "@/components/skeletons";
import { useAuth } from "@/lib/auth";
import { invalidateAdminCache } from "@/lib/admin-cache";
import { planPagesSummary, sanitizePlanPages } from "@/lib/staff-access";
import { BusyButton, ConfirmModal, Page } from "@/components/ui";

export default function AdminBusinessDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ownerId = typeof params.ownerId === "string" ? params.ownerId : "";
  const { user, ready } = useAuth();

  const [owner, setOwner] = useState<OwnerAccount | null>(null);
  const [templates, setTemplates] = useState<ProductTemplateOption[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlanOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadOwner = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    setLoadError(null);
    const result = await getOwnerAction(ownerId);
    setLoading(false);
    if (!result.ok) {
      setLoadError(result.error);
      setOwner(null);
      return;
    }
    setOwner(result.owner);
  }, [ownerId]);

  useEffect(() => {
    if (!ready || user?.role !== "SUPERADMIN" || !ownerId) return;
    void loadOwner();
  }, [ready, user?.role, ownerId, loadOwner]);

  useEffect(() => {
    if (!ready || user?.role !== "SUPERADMIN") return;
    void Promise.all([listProductTemplatesAction(), listSubscriptionPlansAction(true)]).then(
      ([templatesResult, plansResult]) => {
        if (templatesResult.ok) setTemplates(templatesResult.templates);
        if (plansResult.ok) setSubscriptionPlans(plansResult.plans);
      },
    );
  }, [ready, user?.role]);

  const reloadOwner = async () => {
    invalidateAdminCache();
    await loadOwner();
  };

  const revoke = async () => {
    if (!owner) return;
    setRevoking(true);
    const result = await updateOwnerAction(owner.id, { active: false });
    setRevoking(false);
    if (!result.ok) return;
    await reloadOwner();
  };

  const reactivate = async () => {
    if (!owner) return;
    setReactivating(true);
    const result = await updateOwnerAction(owner.id, { active: true });
    setReactivating(false);
    if (!result.ok) return;
    await reloadOwner();
  };

  const confirmDelete = async () => {
    if (!owner || deleting) return;
    setDeleting(true);
    const result = await deleteOwnerAction(owner.id);
    setDeleting(false);
    if (!result.ok) return;
    invalidateAdminCache();
    router.push("/admin/businesses");
  };

  if (ready && user?.role !== "SUPERADMIN") return null;
  if (!ready || loading) return <AdminBusinessDetailSkeleton />;
  if (loadError || !owner) {
    return (
      <Page>
        <Link href="/admin/businesses" className="text-[12px] text-neutral-500 hover:text-black mb-4 inline-block">
          ← Back to businesses
        </Link>
        <p role="alert" className="text-sm text-[#a12b1f]">{loadError ?? "Business not found."}</p>
      </Page>
    );
  }

  const subActive = owner.subscriptionActive ?? owner.business.subscriptionStatus === "ACTIVE";
  const templateMap = new Map(templates.map((t) => [t.id, t.label]));
  const templateTags = (owner.business.assignedTemplateIds ?? []).map(
    (id) => templateMap.get(id) ?? id,
  );
  const activity = owner.activity30d;

  return (
    <Page>
      <Link href="/admin/businesses" className="text-[12px] text-neutral-500 hover:text-black mb-4 inline-block">
        ← Back to businesses
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl tracking-tight font-semibold">{owner.business.name}</h1>
          <p className="text-[#171717]/70 text-xs mt-1 font-mono">/{owner.business.slug}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <StatusBadge active={owner.active} />
            <SubBadge active={subActive} status={owner.business.subscriptionStatus} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost !text-[12px]" onClick={() => setSubOpen(true)}>
            Subscription
          </button>
          <button type="button" className="btn-ghost !text-[12px]" onClick={() => setTemplatesOpen(true)}>
            Templates
          </button>
          <button type="button" className="btn-ghost !text-[12px]" onClick={() => setResetOpen(true)}>
            Reset password
          </button>
          {owner.active ? (
            <BusyButton
              type="button"
              variant="ghost"
              className="!text-[12px] text-[#a12b1f]"
              onClick={() => void revoke()}
              loading={revoking}
            >
              Revoke login
            </BusyButton>
          ) : (
            <BusyButton
              type="button"
              variant="ghost"
              className="!text-[12px]"
              onClick={() => void reactivate()}
              loading={reactivating}
            >
              Reactivate login
            </BusyButton>
          )}
          <BusyButton
            type="button"
            variant="ghost"
            className="!text-[12px] !text-[#a12b1f]"
            onClick={() => setDeleteOpen(true)}
            loading={deleting}
          >
            Delete business
          </BusyButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel p-4 sm:p-5">
          <h2 className="text-[13px] font-semibold mb-1">Owner login</h2>
          <p className="text-[11px] text-neutral-500 mb-3">Credentials shared with the business owner.</p>
          <DetailRow label="Owner name">{owner.name}</DetailRow>
          <DetailRow label="Email">
            <span className="font-mono text-[12px]">{owner.email}</span>
          </DetailRow>
          <DetailRow label="Password">
            <span className="text-[12px] text-neutral-500">
              Stored securely (hashed). Use Reset password to issue a new one.
            </span>
          </DetailRow>
        </div>

        <div className="panel p-4 sm:p-5">
          <h2 className="text-[13px] font-semibold mb-1">Subscription</h2>
          <DetailRow label="Plan">{planLabel(owner.business)}</DetailRow>
          <DetailRow label="Panel modules">
            {planPagesSummary(
              sanitizePlanPages(owner.business.subscriptionPlanDef?.allowedPages),
            )}
          </DetailRow>
          <DetailRow label="Status">{owner.business.subscriptionStatus ?? "—"}</DetailRow>
          <DetailRow label="Started">{fmtDate(owner.business.subscriptionStartsAt)}</DetailRow>
          <DetailRow label="Access until">
            {isLifetimeBusiness(owner.business)
              ? "No expiry (lifetime)"
              : fmtDate(owner.business.subscriptionEndsAt)}
          </DetailRow>
        </div>

        <div className="panel p-4 sm:p-5">
          <h2 className="text-[13px] font-semibold mb-1">Business</h2>
          <DetailRow label="Registered">{fmtDate(owner.createdAt)}</DetailRow>
          <DetailRow label="Business ID">
            <span className="font-mono text-[11px] text-neutral-600">{owner.business.id}</span>
          </DetailRow>
          <DetailRow label="Templates applied">{fmtDate(owner.business.templatesAppliedAt)}</DetailRow>
          <DetailRow label="Assigned templates">
            {templateTags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {templateTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-neutral-400">None</span>
            )}
          </DetailRow>
        </div>

        <div className="panel p-4 sm:p-5">
          <h2 className="text-[13px] font-semibold mb-1">Activity · last 30 days</h2>
          {activity ? (
            <div className="grid grid-cols-3 gap-3 pt-1">
              {[
                ["Sales", activity.sales],
                ["Purchases", activity.purchases],
                ["Payments", activity.payments],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-neutral-100 bg-neutral-50/50 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-widest text-neutral-400">{label}</p>
                  <p className="text-xl font-semibold tabular-nums mt-1">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-neutral-400">No activity data yet.</p>
          )}
        </div>
      </div>

      <ResetPasswordModal
        owner={resetOpen ? owner : null}
        onClose={() => setResetOpen(false)}
        onUpdated={reloadOwner}
      />
      <SubscriptionModal
        owner={subOpen ? owner : null}
        subscriptionPlans={subscriptionPlans}
        onClose={() => setSubOpen(false)}
        onUpdated={reloadOwner}
      />
      <TemplatesModal
        owner={templatesOpen ? owner : null}
        templates={templates}
        onClose={() => setTemplatesOpen(false)}
        onUpdated={reloadOwner}
      />
      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        title={`Delete ${owner.business.name}?`}
        confirmLabel="Delete permanently"
        loading={deleting}
      >
        <p className="text-sm text-neutral-700">
          This permanently removes the business owner account, all staff logins, and every record
          for this business — products, inventory, sales, purchases, payments, and expenses.
        </p>
        <p className="text-sm text-[#a12b1f] mt-2 font-medium">This cannot be undone.</p>
      </ConfirmModal>
    </Page>
  );
}
