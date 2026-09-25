"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  applyOwnerTemplatesAction,
  createOwnerAction,
  updateOwnerAction,
  updateOwnerSubscriptionAction,
  type OwnerAccount,
} from "@/app/actions/users";
import type {
  ProductTemplateOption,
  SubscriptionPlanOption,
  SubscriptionStatus,
} from "@/app/actions/platform";
import { AdminTemplatePickCard } from "@/components/admin/template-pick-card";
import { BillingCycleBadge } from "@/components/admin/subscription-plans-ui";
import { BusyButton, Modal } from "@/components/ui";

export function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        active ? "bg-emerald-50 text-emerald-800" : "bg-neutral-100 text-neutral-600"
      }`}
    >
      {active ? "Active" : "Revoked"}
    </span>
  );
}

export function SubBadge({ active, status }: { active: boolean; status?: string | null }) {
  const cls = active
    ? "bg-emerald-50 text-emerald-800"
    : status === "CANCELLED"
      ? "bg-neutral-100 text-neutral-600"
      : "bg-[#faf5f2] text-[#a12b1f]";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {active ? "Subscribed" : status === "EXPIRED" ? "Expired" : status ?? "Inactive"}
    </span>
  );
}

export function planLabel(
  business?: { subscriptionPlanDef?: { label?: string } | null } | null,
) {
  return business?.subscriptionPlanDef?.label ?? "—";
}

export function isLifetimeBusiness(
  business?: { subscriptionPlanDef?: { billingCycle?: string } | null } | null,
) {
  return business?.subscriptionPlanDef?.billingCycle === "LIFETIME";
}

function activeSubscriptionPlans(plans: SubscriptionPlanOption[]) {
  return plans.filter((plan) => plan.active).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-[#171717]/70">{label}</p>
      <p className="text-2xl sm:text-3xl font-semibold mt-2 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-neutral-500 mt-1">{hint}</p>}
    </div>
  );
}

export function ActionMenu({
  items,
}: {
  items: {
    label: string;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
  }[];
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuW = 168;

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuH = Math.max(44, items.length * 36 + 8);
    let top = rect.bottom + 4;
    let left = rect.right - menuW;
    left = Math.max(8, Math.min(left, window.innerWidth - menuW - 8));
    if (top + menuH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuH - 4);
    }
    setMenuPos({ top, left });
  }, [open, items.length]);

  return (
    <span
      className="relative inline-block shrink-0 text-left"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        ref={btnRef}
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="btn-ghost !py-1 !px-2.5 text-[11px] inline-flex min-h-0 items-center gap-1"
      >
        More
        <svg
          className={`w-3 h-3 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)} aria-hidden />
            <div
              role="menu"
              className="fixed z-[201] min-w-[10.5rem] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
              style={{ top: menuPos.top, left: menuPos.left }}
              onClick={(e) => e.stopPropagation()}
            >
              {items.map((item, i) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    setOpen(false);
                    item.onClick();
                  }}
                  className={`w-full px-3 py-2 text-left text-[12px] transition-colors disabled:opacity-50 ${
                    item.danger ? "text-[#a12b1f] hover:bg-[#faf5f2]" : "text-black hover:bg-neutral-50"
                  } ${i > 0 ? "border-t border-neutral-100" : ""}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </span>
  );
}

function InfoCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.08em] text-neutral-400 mb-1">{label}</p>
      <div className="text-[12px] leading-snug text-neutral-800">{children}</div>
    </div>
  );
}

export function PasswordReveal({ password }: { password: string | null }) {
  const [show, setShow] = useState(false);
  if (!password) {
    return <span className="text-neutral-400 text-[12px]">Not stored — reset to set one</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[13px] text-neutral-800 tabular-nums">
        {show ? password : "••••••••••"}
      </span>
      <button
        type="button"
        className="btn-ghost !py-1 !px-2 text-[11px] min-h-0"
        onClick={() => setShow((value) => !value)}
      >
        {show ? "Hide" : "Show password"}
      </button>
    </div>
  );
}

export function BusinessListTable({
  owners,
  planFor,
}: {
  owners: OwnerAccount[];
  planFor: (owner: OwnerAccount) => string;
}) {
  return (
    <>
      <ul className="md:hidden space-y-3">
        {owners.map((owner) => (
          <li key={owner.id}>
            <Link
              href={`/admin/businesses/${owner.id}`}
              className={`panel block p-4 transition-colors hover:bg-neutral-50/80 active:bg-neutral-50 ${owner.active ? "" : "opacity-75"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-neutral-900 truncate">{owner.business.name}</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5 font-mono truncate">/{owner.business.slug}</p>
                  <p className="text-[12px] text-neutral-600 mt-2 truncate">{owner.name}</p>
                  <p className="font-mono text-[11px] text-neutral-500 truncate">{owner.email}</p>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-neutral-500">View →</span>
              </div>
              <div className="mt-3 pt-3 border-t border-neutral-100 flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-medium text-neutral-800">{planFor(owner)}</span>
                <StatusBadge active={owner.active} />
                <SubBadge
                  active={owner.business.subscriptionStatus === "ACTIVE"}
                  status={owner.business.subscriptionStatus}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden md:block panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/80">
              <th className="px-4 py-2.5 text-[10px] uppercase tracking-[0.1em] font-medium text-neutral-500">
                Business
              </th>
              <th className="px-4 py-2.5 text-[10px] uppercase tracking-[0.1em] font-medium text-neutral-500">
                Email
              </th>
              <th className="px-4 py-2.5 text-[10px] uppercase tracking-[0.1em] font-medium text-neutral-500">
                Subscription
              </th>
              <th className="px-4 py-2.5 text-[10px] uppercase tracking-[0.1em] font-medium text-neutral-500 text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {owners.map((owner) => (
              <tr key={owner.id} className={`hover:bg-neutral-50/60 ${owner.active ? "" : "opacity-70"}`}>
                <td className="px-4 py-3">
                  <p className="text-[13px] font-semibold text-neutral-900 truncate">{owner.business.name}</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5 truncate">/{owner.business.slug}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-mono text-[12px] text-neutral-700 truncate">{owner.email}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-[12px] font-medium text-neutral-800">{planFor(owner)}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <StatusBadge active={owner.active} />
                    <SubBadge
                      active={owner.business.subscriptionStatus === "ACTIVE"}
                      status={owner.business.subscriptionStatus}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/businesses/${owner.id}`} className="btn-ghost !py-1.5 !px-3 text-[12px]">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-3 border-b border-neutral-100 last:border-b-0">
      <p className="text-[10px] uppercase tracking-[0.1em] text-neutral-400 mb-1">{label}</p>
      <div className="text-[13px] text-neutral-800 break-words">{children}</div>
    </div>
  );
}

export function BusinessAccountCard({
  owner,
  subActive,
  activity,
  planLabel: plan,
  templateTags,
  onSubscription,
  onTemplates,
  onResetPassword,
  onRevoke,
  onReactivate,
  revoking,
  reactivating,
}: {
  owner: OwnerAccount;
  subActive: boolean;
  activity?: { sales: number; purchases: number; payments: number };
  planLabel: string;
  templateTags: string[];
  onSubscription: () => void;
  onTemplates: () => void;
  onResetPassword: () => void;
  onRevoke: () => void;
  onReactivate: () => void;
  revoking: boolean;
  reactivating: boolean;
}) {
  const moreItems = owner.active
    ? [
        { label: "Reset password", onClick: onResetPassword },
        {
          label: revoking ? "Revoking…" : "Revoke login",
          onClick: onRevoke,
          danger: true,
          disabled: revoking,
        },
      ]
    : [
        { label: "Reset password", onClick: onResetPassword },
        {
          label: reactivating ? "Reactivating…" : "Reactivate login",
          onClick: onReactivate,
          disabled: reactivating,
        },
      ];

  return (
    <article className={`panel p-3 sm:p-4 ${owner.active ? "" : "opacity-75"}`}>
      <div className="mb-3 pb-3 border-b border-neutral-100">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <h3 className="text-[13px] sm:text-sm font-semibold tracking-tight truncate">
              {owner.business.name}
            </h3>
            <StatusBadge active={owner.active} />
            <SubBadge active={subActive} status={owner.business.subscriptionStatus} />
          </div>
          <p className="font-mono text-[10px] sm:text-[11px] text-neutral-500">
            /{owner.business.slug}
            <span className="text-neutral-300 mx-1.5">·</span>
            Since {fmtDate(owner.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <InfoCell label="Owner account">
          <p className="font-medium text-[13px]">{owner.name}</p>
          <p className="font-mono text-[11px] text-neutral-600 truncate mt-0.5">{owner.email}</p>
        </InfoCell>

        <InfoCell label="Subscription">
          <p className="font-medium">{plan}</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            {isLifetimeBusiness(owner.business)
              ? "No expiry"
              : `Until ${fmtDate(owner.business.subscriptionEndsAt)}`}
          </p>
          {templateTags.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {templateTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-neutral-400 mt-1">No templates</p>
          )}
        </InfoCell>

        <InfoCell label="Activity · 30 days">
          {activity ? (
            <div className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums text-[11px]">
              <span><span className="font-semibold text-neutral-900">{activity.sales}</span> sales</span>
              <span><span className="font-semibold text-neutral-900">{activity.purchases}</span> purchases</span>
              <span><span className="font-semibold text-neutral-900">{activity.payments}</span> payments</span>
            </div>
          ) : (
            <span className="text-neutral-400">—</span>
          )}
        </InfoCell>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1.5 mt-3 pt-3 border-t border-neutral-100">
        <button
          type="button"
          className="btn-ghost !py-1 !px-2.5 text-[11px] min-h-0"
          onClick={onSubscription}
        >
          Subscription
        </button>
        <button
          type="button"
          className="btn-ghost !py-1 !px-2.5 text-[11px] min-h-0"
          onClick={onTemplates}
        >
          Templates
        </button>
        <ActionMenu items={moreItems} />
      </div>
    </article>
  );
}

function AdminFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50/40 p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-[13px] font-semibold text-neutral-900">{title}</h3>
        {description ? <p className="text-[12px] text-neutral-500 mt-1 leading-relaxed">{description}</p> : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function randomPassword(length = 12) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$";
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) out += chars[bytes[i]! % chars.length];
  return out;
}

export function AddOwnerModal({
  open,
  templates,
  subscriptionPlans,
  onClose,
  onCreated,
}: {
  open: boolean;
  templates: ProductTemplateOption[];
  subscriptionPlans: SubscriptionPlanOption[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const defaultPlanId = activeSubscriptionPlans(subscriptionPlans)[0]?.id ?? "sub_monthly";
  const [form, setForm] = useState({
    businessName: "",
    name: "",
    email: "",
    password: "",
    subscriptionPlanId: defaultPlanId,
    templateIds: [] as string[],
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    setForm({
      businessName: "",
      name: "",
      email: "",
      password: "",
      subscriptionPlanId: defaultPlanId,
      templateIds: [],
    });
    setError(null);
    onClose();
  };

  const toggleTemplate = (id: string) => {
    setForm((f) => ({
      ...f,
      templateIds: f.templateIds.includes(id)
        ? f.templateIds.filter((x) => x !== id)
        : [...f.templateIds, id],
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const result = await createOwnerAction({ ...form });
    setPending(false);
    if (!result.ok) return setError(result.error);
    await onCreated();
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Register business owner"
      subtitle="Set up login, subscription, and optional catalogue templates. The owner adds their logo later in Settings."
      size="lg"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
          <button type="button" className="btn-ghost w-full sm:w-auto" onClick={close}>
            Cancel
          </button>
          <BusyButton type="submit" form="register-owner-form" loading={pending} className="w-full sm:w-auto">
            Create owner account
          </BusyButton>
        </div>
      }
    >
      {error && (
        <p role="alert" className="text-sm text-[#a12b1f] mb-4 rounded-md border border-[#f0d2cc] bg-[#fdf1ef] px-3 py-2">
          {error}
        </p>
      )}
      <form id="register-owner-form" className="flex flex-col gap-5" onSubmit={submit}>
        <AdminFormSection
          title="Business"
          description="Shop or factory name shown across the owner panel and on bills."
        >
          <div>
            <label htmlFor="owner-businessName">Business name</label>
            <input
              id="owner-businessName"
              type="text"
              value={form.businessName}
              placeholder="e.g. Al-Noor Steel Traders"
              autoComplete="organization"
              onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
            />
          </div>
        </AdminFormSection>

        <AdminFormSection
          title="Owner login"
          description="Share these credentials with the business owner. Password is stored securely (hashed)."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="owner-name">Owner name</label>
              <input
                id="owner-name"
                type="text"
                value={form.name}
                placeholder="Full name"
                autoComplete="name"
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="owner-email">Email</label>
              <input
                id="owner-email"
                type="email"
                value={form.email}
                placeholder="owner@example.com"
                autoComplete="email"
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
          </div>
          <div>
            <div className="flex flex-wrap items-end justify-between gap-2 mb-1.5">
              <label htmlFor="owner-password" className="!mb-0">
                Password
              </label>
              <button
                type="button"
                className="text-[11px] font-medium text-neutral-600 hover:text-black underline underline-offset-2"
                onClick={() => setForm((f) => ({ ...f, password: randomPassword() }))}
              >
                Generate secure password
              </button>
            </div>
            <input
              id="owner-password"
              type="text"
              value={form.password}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            />
            <p className="text-[11px] text-neutral-500 mt-1.5">Copy this before creating — it cannot be retrieved later.</p>
          </div>
        </AdminFormSection>

        <AdminFormSection title="Subscription & catalogue">
          <div>
            <label htmlFor="owner-plan">Subscription plan</label>
            <select
              id="owner-plan"
              value={form.subscriptionPlanId}
              onChange={(e) => setForm((f) => ({ ...f, subscriptionPlanId: e.target.value }))}
            >
              {activeSubscriptionPlans(subscriptionPlans).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.label}
                </option>
              ))}
            </select>
            {(() => {
              const plan = subscriptionPlans.find((p) => p.id === form.subscriptionPlanId);
              if (!plan) return null;
              return (
                <p className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-600 mt-2">
                  <span>Billing type:</span>
                  <BillingCycleBadge cycle={plan.billingCycle} durationDays={plan.durationDays} />
                </p>
              );
            })()}
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Product templates (optional)</p>
            <p className="text-[11px] text-neutral-500 mb-3">
              Pre-build catalogue on first login — steel, cement, wire, paint, tiles, etc.
            </p>
            {templates.length === 0 ? (
              <p className="text-[12px] text-neutral-400 rounded-md border border-dashed border-neutral-200 px-3 py-4 text-center">
                No templates yet. You can assign them later from the business detail page.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {templates.map((t) => (
                  <AdminTemplatePickCard
                    key={t.id}
                    id={t.id}
                    label={t.label}
                    productName={t.productName}
                    productUnit={t.productUnit}
                    usesCategories={t.usesCategories}
                    selected={form.templateIds.includes(t.id)}
                    onChange={() => toggleTemplate(t.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </AdminFormSection>
      </form>
    </Modal>
  );
}

export function SubscriptionModal({
  owner,
  subscriptionPlans,
  onClose,
  onUpdated,
}: {
  owner: OwnerAccount | null;
  subscriptionPlans: SubscriptionPlanOption[];
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [planId, setPlanId] = useState("sub_monthly");
  const [status, setStatus] = useState<SubscriptionStatus>("ACTIVE");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!owner) return;
    setPlanId(owner.business.subscriptionPlanId ?? owner.business.subscriptionPlanDef?.id ?? "sub_monthly");
    setStatus(owner.business.subscriptionStatus ?? "ACTIVE");
    setEndsAt(owner.business.subscriptionEndsAt?.slice(0, 10) ?? "");
    setError(null);
  }, [owner]);

  const close = () => {
    setError(null);
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!owner || pending) return;
    setPending(true);
    const selected = subscriptionPlans.find((item) => item.id === planId);
    const result = await updateOwnerSubscriptionAction(owner.id, {
      planId,
      status,
      endsAt: selected?.billingCycle === "LIFETIME" ? undefined : endsAt || undefined,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    await onUpdated();
    close();
  };

  return (
    <Modal open={Boolean(owner)} onClose={close} title={`Subscription — ${owner?.business.name ?? ""}`}>
      {error && <p role="alert" className="text-sm text-[#a12b1f] mb-3">{error}</p>}
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div>
          <label htmlFor="sub-plan">Plan</label>
          <select id="sub-plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {activeSubscriptionPlans(subscriptionPlans).map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sub-status">Status</label>
          <select
            id="sub-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
          >
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
        {subscriptionPlans.find((item) => item.id === planId)?.billingCycle !== "LIFETIME" && (
          <div>
            <label htmlFor="sub-ends">Access until</label>
            <input
              id="sub-ends"
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
          <BusyButton type="submit" loading={pending} disabled={!owner}>
            Save subscription
          </BusyButton>
        </div>
      </form>
    </Modal>
  );
}

export function TemplatesModal({
  owner,
  templates,
  onClose,
  onUpdated,
}: {
  owner: OwnerAccount | null;
  templates: ProductTemplateOption[];
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!owner) return;
    setSelected(owner.business.assignedTemplateIds ?? []);
    setError(null);
  }, [owner]);

  const close = () => {
    setError(null);
    onClose();
  };

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!owner || pending) return;
    if (!selected.length) return setError("Select at least one template.");
    setPending(true);
    const result = await applyOwnerTemplatesAction(owner.id, selected);
    setPending(false);
    if (!result.ok) return setError(result.error);
    await onUpdated();
    close();
  };

  const assigned = owner?.business.assignedTemplateIds ?? [];

  return (
    <Modal open={Boolean(owner)} onClose={close} title={`Product templates — ${owner?.business.name ?? ""}`} size="lg">
      {error && <p role="alert" className="text-sm text-[#a12b1f] mb-3">{error}</p>}
      <p className="text-xs text-neutral-500 mb-4">
        Add catalogue templates to an existing business. Products that already exist (same name) are skipped.
        {assigned.length ? ` Last applied ${fmtDate(owner?.business.templatesAppliedAt)}.` : ""}
      </p>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div className="grid grid-cols-1 gap-2">
          {templates.map((t) => {
            const wasAssigned = assigned.includes(t.id);
            return (
              <AdminTemplatePickCard
                key={t.id}
                id={t.id}
                label={t.label}
                productName={t.productName}
                productUnit={t.productUnit}
                usesCategories={t.usesCategories}
                selected={selected.includes(t.id)}
                onChange={() => toggle(t.id)}
                assigned={wasAssigned}
              />
            );
          })}
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
          <BusyButton type="submit" loading={pending} disabled={!owner}>
            Apply templates
          </BusyButton>
        </div>
      </form>
    </Modal>
  );
}

export function ResetPasswordModal({
  owner,
  onClose,
  onUpdated,
}: {
  owner: OwnerAccount | null;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    setPassword("");
    setError(null);
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!owner || pending) return;
    setPending(true);
    const result = await updateOwnerAction(owner.id, { password });
    setPending(false);
    if (!result.ok) return setError(result.error);
    await onUpdated();
    close();
  };

  return (
    <Modal open={Boolean(owner)} onClose={close} title={`Reset password — ${owner?.name ?? ""}`}>
      {error && <p role="alert" className="text-sm text-[#a12b1f] mb-3">{error}</p>}
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div>
          <label htmlFor="reset-password">New password</label>
          <input
            id="reset-password"
            type="text"
            value={password}
            placeholder="At least 8 characters"
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
          <BusyButton type="submit" loading={pending} disabled={!owner}>
            Save password
          </BusyButton>
        </div>
      </form>
    </Modal>
  );
}
