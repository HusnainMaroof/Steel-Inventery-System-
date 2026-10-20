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
  planLabel,
  EditOwnerModal,
  ResetPasswordModal,
  StatusBadge,
  SubBadge,
  SubscriptionModal,
  TemplatesModal,
  ActionMenu,
  AdminCard,
  ActivityStatStrip,
  CopyButton,
  SubscriptionExpHint,
} from "@/components/admin/admin-ui";
import { AdminBusinessDetailSkeleton } from "@/components/skeletons";
import { useAuth } from "@/lib/auth";
import { invalidateAdminCache } from "@/lib/admin-cache";
import { planPagesSummary, sanitizePlanPages } from "@/lib/staff-access";
import { ConfirmModal, Page } from "@/components/ui";
import { ChevronLeft, Pencil } from "lucide-react";

type OwnerResult = Awaited<ReturnType<typeof getOwnerAction>>;
type TemplatesResult = Awaited<ReturnType<typeof listProductTemplatesAction>>;
type PlansResult = Awaited<ReturnType<typeof listSubscriptionPlansAction>>;

/**
 * Module-level in-flight dedupe. Next.js dev remounts this page (Strict Mode
 * double-mount) and each fresh instance re-runs its load effects with brand
 * new refs - only module scope survives remounts. `force` bypasses the
 * dedupe for explicit reloads after mutations.
 */
const ownerInFlight = new Map<string, Promise<OwnerResult>>();

function requestOwner(ownerId: string, force = false): Promise<OwnerResult> {
  if (force) ownerInFlight.delete(ownerId);
  let request = ownerInFlight.get(ownerId);
  if (!request) {
    request = getOwnerAction(ownerId).finally(() => {
      ownerInFlight.delete(ownerId);
    });
    ownerInFlight.set(ownerId, request);
  }
  return request;
}

let adminMetaInFlight: Promise<[TemplatesResult, PlansResult]> | null = null;

function requestAdminMeta(force = false): Promise<[TemplatesResult, PlansResult]> {
  if (force) adminMetaInFlight = null;
  if (!adminMetaInFlight) {
    adminMetaInFlight = Promise.all([
      listProductTemplatesAction(),
      listSubscriptionPlansAction(true),
    ] as const).finally(() => {
      adminMetaInFlight = null;
    });
  }
  return adminMetaInFlight;
}

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
  const [editOpen, setEditOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadOwner = useCallback(async (force = false) => {
    if (!ownerId) return;
    setLoading(true);
    setLoadError(null);
    const result = await requestOwner(ownerId, force);
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
    void requestAdminMeta().then(([templatesResult, plansResult]) => {
      if (templatesResult.ok) setTemplates(templatesResult.templates);
      if (plansResult.ok) setSubscriptionPlans(plansResult.plans);
    });
  }, [ready, user?.role]);

  const reloadOwner = async () => {
    invalidateAdminCache();
    await loadOwner(true);
  };

  const revoke = async () => {
    if (!owner) return;
    setRevoking(true);
    const result = await updateOwnerAction(owner.id, { active: false });
    setRevoking(false);
    if (!result.ok) {
      setRevokeError(result.error);
      return;
    }
    setRevokeOpen(false);
    await reloadOwner();
  };

  const reactivate = async () => {
    if (!owner) return;
    setActionError(null);
    setReactivating(true);
    const result = await updateOwnerAction(owner.id, { active: true });
    setReactivating(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    await reloadOwner();
  };

  const confirmDelete = async () => {
    if (!owner || deleting) return;
    setDeleting(true);
    const result = await deleteOwnerAction(owner.id);
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    invalidateAdminCache();
    router.push("/admin/businesses");
  };

  if (ready && user?.role !== "SUPERADMIN") return null;
  if (!ready || loading) return <AdminBusinessDetailSkeleton />;
  if (loadError || !owner) {
    return (
      <Page>
        <Link
          href="/admin/businesses"
          className="text-[13px] text-[#171717]/70 hover:text-[#171717] mb-4 inline-flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          Back to businesses
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
      <Link
        href="/admin/businesses"
        className="text-[13px] text-[#171717]/70 hover:text-[#171717] mb-4 inline-flex items-center gap-1"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        Back to businesses
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl tracking-tight font-semibold text-[#171717] truncate">
            {owner.business.name}
          </h1>
          <p className="text-[#171717]/70 text-[13px] mt-1 font-mono truncate">/{owner.business.slug}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <StatusBadge active={owner.active} />
            <SubBadge active={subActive} status={owner.business.subscriptionStatus} />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <button type="button" className="btn-primary flex-1 sm:flex-none" onClick={() => setSubOpen(true)}>
            Subscription
          </button>
          <button type="button" className="btn-ghost flex-1 sm:flex-none" onClick={() => setTemplatesOpen(true)}>
            Templates
          </button>
          <button type="button" className="btn-ghost inline-flex items-center justify-center gap-2 flex-1 sm:flex-none" onClick={() => setEditOpen(true)}>
            <Pencil className="w-4 h-4" aria-hidden="true" />
            Edit
          </button>
          <div className="shrink-0">
            <ActionMenu
              items={[
                { label: "Reset password", onClick: () => setResetOpen(true) },
                owner.active
                  ? {
                      label: revoking ? "Revoking..." : "Revoke login",
                      onClick: () => {
                        setRevokeError(null);
                        setRevokeOpen(true);
                      },
                      danger: true,
                      disabled: revoking,
                    }
                  : {
                      label: reactivating ? "Reactivating..." : "Reactivate login",
                      onClick: () => void reactivate(),
                      disabled: reactivating,
                    },
                {
                  label: "Delete business",
                  onClick: () => {
                    setDeleteError(null);
                    setDeleteOpen(true);
                  },
                  danger: true,
                  disabled: deleting,
                },
              ]}
            />
          </div>
        </div>
      </div>

      {actionError ? <p role="alert" className="text-sm text-[#a12b1f] mb-4">{actionError}</p> : null}

      {/* usage strip on its own row, so it never stretches to a tall empty card */}
      <div className="mb-4">
        <ActivityStatStrip activity={activity} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <AdminCard title="Owner login">
          <p className="text-[13px] text-[#171717]/70 mb-4">
            Credentials shared with the business owner.
          </p>
          <DetailRow label="Owner name">{owner.name}</DetailRow>
          <DetailRow label="Email">{owner.email}</DetailRow>
          <DetailRow label="Password">
            <span className="text-[13px] text-[#171717]/70">Hidden for security</span>
          </DetailRow>
        </AdminCard>

        <AdminCard title="Subscription">
          <DetailRow label="Plan">{planLabel(owner.business)}</DetailRow>
          <DetailRow label="Panel modules">
            {planPagesSummary(
              sanitizePlanPages(owner.business.subscriptionPlanDef?.allowedPages),
            )}
          </DetailRow>
          <DetailRow label="Status">
            <SubBadge active={subActive} status={owner.business.subscriptionStatus} />
          </DetailRow>
          <DetailRow label="Started">{fmtDate(owner.business.subscriptionStartsAt)}</DetailRow>
          <DetailRow label="Access until">
            <SubscriptionExpHint business={owner.business} />
          </DetailRow>
        </AdminCard>

        <AdminCard title="Business">
          <DetailRow label="Registered">{fmtDate(owner.createdAt)}</DetailRow>
          <DetailRow label="Business ID">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-[13px] text-[#171717] break-all">{owner.business.id}</span>
              <CopyButton text={owner.business.id} label="Copy ID" />
            </span>
          </DetailRow>
          <DetailRow label="Templates applied">{fmtDate(owner.business.templatesAppliedAt)}</DetailRow>
          <DetailRow label="Assigned templates">
            {templateTags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {templateTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex rounded-full bg-[#F8F8F7] px-2 py-0.5 text-xs text-[#171717]/70"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[13px] text-[#171717]/70">None</span>
            )}
          </DetailRow>
        </AdminCard>
      </div>

      <ResetPasswordModal
        owner={resetOpen ? owner : null}
        onClose={() => setResetOpen(false)}
        onUpdated={reloadOwner}
      />
      <EditOwnerModal
        owner={editOpen ? owner : null}
        onClose={() => setEditOpen(false)}
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
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        onConfirm={revoke}
        title={`Turn off login for ${owner.business.name}?`}
        confirmLabel="Turn off login"
        loading={revoking}
        error={revokeError}
      >
        <p className="text-sm text-[#171717]/70">
          The owner can no longer sign in. The business and all its records stay as they are. You can turn the login back on from this page at any time.
        </p>
      </ConfirmModal>
      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        title={`Delete ${owner.business.name}?`}
        confirmLabel="Delete permanently"
        loading={deleting}
        error={deleteError}
      >
        <p className="text-sm text-[#171717]/70">
          This permanently removes the business owner account, all staff logins, and every record
          for this business: products, inventory, sales, purchases, payments, and expenses.
        </p>
        <p className="text-sm text-[#a12b1f] mt-2 font-medium">This cannot be undone.</p>
      </ConfirmModal>
    </Page>
  );
}
