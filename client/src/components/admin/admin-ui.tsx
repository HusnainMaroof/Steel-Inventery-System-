"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { uploadBusinessLogoAction } from "@/app/actions/media";
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
      <p className="text-3xl font-semibold mt-2 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-neutral-500 mt-1">{hint}</p>}
    </div>
  );
}

function ActionMenu({
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

  return (
    <span className="relative inline-block text-left shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost !py-1 !px-2.5 text-[11px] inline-flex items-center gap-1 min-h-0"
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
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-30 min-w-[10.5rem] bg-white border border-neutral-200 rounded-lg shadow-lg py-1">
            {items.map((item, i) => (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  item.onClick();
                }}
                className={`w-full text-left px-3 py-2 text-[12px] transition-colors disabled:opacity-50 ${
                  item.danger ? "text-[#a12b1f] hover:bg-[#faf5f2]" : "text-black hover:bg-neutral-50"
                } ${i > 0 ? "border-t border-neutral-100" : ""}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
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
    <div className="panel overflow-hidden">
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
  );
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-3 border-b border-neutral-100 last:border-b-0">
      <p className="text-[10px] uppercase tracking-[0.1em] text-neutral-400 mb-1">{label}</p>
      <div className="text-[13px] text-neutral-800">{children}</div>
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
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    businessName: "",
    name: "",
    email: "",
    password: "",
    subscriptionPlanId: defaultPlanId,
    templateIds: [] as string[],
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const close = () => {
    setForm({
      businessName: "",
      name: "",
      email: "",
      password: "",
      subscriptionPlanId: defaultPlanId,
      templateIds: [],
    });
    clearLogo();
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

  const onPickLogo = (file: File | undefined) => {
    if (!file) return;
    const type = file.type;
    if (type !== "image/png" && type !== "image/jpeg" && type !== "image/webp") {
      setError("Use a PNG, JPG, or WebP image for the logo.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Logo image must be under 8 MB.");
      return;
    }
    setError(null);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    let logoUrl: string | undefined;
    if (logoFile) {
      const payload = new FormData();
      payload.append("logo", logoFile);
      const upload = await uploadBusinessLogoAction(payload);
      if (!upload.ok) {
        setPending(false);
        setError(upload.error);
        return;
      }
      logoUrl = upload.url;
    }

    const result = await createOwnerAction({ ...form, logoUrl });
    setPending(false);
    if (!result.ok) return setError(result.error);
    await onCreated();
    close();
  };

  return (
    <Modal open={open} onClose={close} title="Register business owner" size="lg">
      {error && <p role="alert" className="text-sm text-[#a12b1f] mb-3">{error}</p>}
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {([
          ["businessName", "Business name", "Their shop or factory"],
          ["name", "Owner name", "Owner name"],
          ["email", "Email", "owner@example.com"],
          ["password", "Password", "At least 8 characters"],
        ] as const).map(([key, label, placeholder]) => (
          <div key={key}>
            <label htmlFor={`owner-${key}`}>{label}</label>
            <input
              id={`owner-${key}`}
              type={key === "password" ? "password" : key === "email" ? "email" : "text"}
              value={form[key]}
              placeholder={placeholder}
              onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
            />
          </div>
        ))}

        <div>
          <p className="text-sm font-medium mb-2">Business logo (optional)</p>
          <p className="text-xs text-neutral-500 mb-3">
            Uploaded to Cloudinary, compressed on the server, and shown in the owner&apos;s menu and bills.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="h-20 w-36 border border-neutral-200 rounded-md bg-white flex items-center justify-center p-2">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-[11px] text-neutral-400">No logo</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => onPickLogo(event.target.files?.[0])}
              />
              <button
                type="button"
                className="btn-ghost !text-[12px]"
                onClick={() => logoInputRef.current?.click()}
              >
                {logoPreview ? "Change logo" : "Upload logo"}
              </button>
              {logoPreview ? (
                <button type="button" className="btn-ghost !text-[12px]" onClick={clearLogo}>
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="owner-plan">Subscription plan</label>
          <select
            id="owner-plan"
            value={form.subscriptionPlanId}
            onChange={(e) => setForm((f) => ({ ...f, subscriptionPlanId: e.target.value }))}
          >
            {activeSubscriptionPlans(subscriptionPlans).map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.label}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Product templates (optional)</p>
          <p className="text-xs text-neutral-500 mb-3">
            Pre-build the catalogue when the owner first logs in — steel, cement, wire, paint, or tiles.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {templates.map((t) => (
              <label
                key={t.id}
                className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer ${
                  form.templateIds.includes(t.id) ? "border-black bg-neutral-50" : "border-neutral-200"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.templateIds.includes(t.id)}
                  onChange={() => toggleTemplate(t.id)}
                />
                <span>
                  <span className="block text-sm font-medium">{t.label}</span>
                  <span className="block text-xs text-neutral-500">{t.productName} · {t.productUnit}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
          <BusyButton type="submit" loading={pending}>
            Create owner
          </BusyButton>
        </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {templates.map((t) => {
            const wasAssigned = assigned.includes(t.id);
            const checked = selected.includes(t.id);
            return (
              <label
                key={t.id}
                className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer ${
                  checked ? "border-black bg-neutral-50" : "border-neutral-200"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  onChange={() => toggle(t.id)}
                />
                <span>
                  <span className="block text-sm font-medium">{t.label}</span>
                  <span className="block text-xs text-neutral-500">{t.productName} · {t.productUnit}</span>
                  {wasAssigned && (
                    <span className="block text-[11px] text-emerald-700 mt-0.5">Already assigned</span>
                  )}
                </span>
              </label>
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
