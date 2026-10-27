"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  applyOwnerTemplatesAction,
  createOwnerAction,
  updateOwnerAction,
  updateOwnerSubscriptionAction,
  type OwnerAccount,
  type OwnerBusiness,
} from "@/app/actions/users";
import type {
  ProductTemplateOption,
  SubscriptionPlanOption,
  SubscriptionStatus,
} from "@/app/actions/platform";
import { uploadBusinessLogoAction } from "@/app/actions/media";
import { MAX_LOGO_BYTES } from "@/lib/logo-limits";
import { AdminTemplatePickCard } from "@/components/admin/template-pick-card";
import { BillingCycleBadge } from "@/components/admin/subscription-plans-ui";
import { BusyButton, Modal } from "@/components/ui";

export function fmtDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-success/10 text-success" : "bg-[#E5E5E5] text-[#171717]/70"
      }`}
    >
      {active ? "Active" : "Login off"}
    </span>
  );
}

export function SubBadge({ active, status }: { active: boolean; status?: string | null }) {
  const cls = active
    ? "bg-success/10 text-success"
    : status === "CANCELLED"
      ? "bg-[#E5E5E5] text-[#171717]/70"
      : "bg-destructive/10 text-destructive";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {active ? "Subscribed" : status === "EXPIRED" ? "Expired" : status ?? "Inactive"}
    </span>
  );
}

export function planLabel(
  business?: { subscriptionPlanDef?: { label?: string } | null } | null,
) {
  return business?.subscriptionPlanDef?.label ?? "-";
}

/**
 * One status per business row (replaces the old StatusBadge + SubBadge pair).
 * Active = login on and subscription active. Expired = subscription ended.
 * Login off = owner login revoked.
 */
export type BusinessStatus = "Active" | "Expired" | "Login off";

/**
 * Mirrors isSubscriptionActive in server/src/subscription/subscription.util.ts.
 * The owners list has no subscriptionActive field, and status alone stays ACTIVE
 * after the end date passes, when the owner can no longer sign in.
 */
export function isSubscriptionLive(business: OwnerBusiness): boolean {
  const cycle = business.subscriptionPlanDef?.billingCycle;
  if (!cycle) return true;
  if (business.subscriptionStatus !== "ACTIVE") return false;
  if (cycle === "LIFETIME" || !business.subscriptionEndsAt) return true;
  return new Date(business.subscriptionEndsAt).getTime() >= Date.now();
}

/** The one status a business row shows; the list filter uses the same rule. */
export function businessStatus(owner: OwnerAccount): BusinessStatus {
  if (!owner.active) return "Login off";
  if (!isSubscriptionLive(owner.business)) return "Expired";
  return "Active";
}

export function BusinessStatusBadge({
  ownerActive,
  subscriptionActive,
}: {
  ownerActive: boolean;
  subscriptionActive: boolean;
  subscriptionStatus?: string | null;
}) {
  if (!ownerActive) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#E5E5E5] px-2 py-0.5 text-xs font-medium text-[#171717]/70">
        Login off
      </span>
    );
  }
  if (!subscriptionActive) {
    return (
      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
      Active
    </span>
  );
}

export function isLifetimeBusiness(
  business?: { subscriptionPlanDef?: { billingCycle?: string } | null } | null,
) {
  return business?.subscriptionPlanDef?.billingCycle === "LIFETIME";
}

/** Days remaining before subscription ends. Returns null for lifetime. */
export function daysUntilExpiry(business: OwnerBusiness): number | null {
  if (isLifetimeBusiness(business)) return null;
  const end = business.subscriptionEndsAt;
  if (!end) return null;
  const ms = new Date(end).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/** Coloured hint text for the subscription expiry line in lists and cards. */
export function SubscriptionExpHint({ business }: { business: OwnerBusiness }) {
  const d = daysUntilExpiry(business);
  if (d === null) {
    return <span className="text-[13px] text-[#171717]/70">No expiry</span>;
  }
  if (d < 0) {
    return (
      <span className="text-[13px] text-destructive">
        Ended {Math.abs(d)} days ago
      </span>
    );
  }
  if (d <= 7) {
    return (
      <span className="text-[13px] text-warning">
        Until {fmtDate(business.subscriptionEndsAt)} ({d} days left)
      </span>
    );
  }
  return (
    <span className="text-[13px] text-[#171717]/70">
      Until {fmtDate(business.subscriptionEndsAt)} ({d} days left)
    </span>
  );
}

/** Copy-to-clipboard text button with "Copied" feedback. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : `Copy ${label}`}
      className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] font-medium transition-colors ${
        copied ? "border-success/30 bg-success/10 text-success" : "border-line text-[#171717] hover:border-[#171717]"
      }`}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function activeSubscriptionPlans(plans: SubscriptionPlanOption[]) {
  return plans.filter((plan) => plan.active).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Page title block for every admin page: a strong heading, one short line, actions on the right. */
export function AdminPageHeader({
  title,
  meta,
  actions,
  back,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line pb-6">
      <div className="min-w-0">
        {back ? (
          <Link
            href={back.href}
            className="mb-3 inline-flex min-h-8 items-center text-[13px] font-medium text-[#171717]/70 hover:text-ink"
          >
            {back.label}
          </Link>
        ) : null}
        <h1 className="truncate text-[28px] leading-[1.15] font-bold tracking-[-0.03em] text-ink sm:text-[32px]">{title}</h1>
        {meta ? <p className="mt-1.5 text-[14px] text-[#171717]/70">{meta}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Section title inside an admin page: bold, with an optional link or action on the right. */
export function AdminSectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[16px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
      {action}
    </div>
  );
}

export type Stat = {
  label: string;
  value: number;
  /** One short line of context under the number. */
  hint?: string;
  tone?: "default" | "alert" | "warn" | "good";
  href?: string;
};

const toneClass: Record<NonNullable<Stat["tone"]>, string> = {
  default: "text-ink",
  alert: "text-destructive",
  warn: "text-warning",
  good: "text-success",
};

/**
 * A row of numbers in one panel, split by hairlines (no boxes, no icons).
 * The label reads as the heading; the number is the loudest thing.
 */
export function StatGroup({ stats, columns = 4 }: { stats: Stat[]; columns?: 2 | 3 | 4 }) {
  const cols = columns === 4 ? "grid-cols-2 lg:grid-cols-4" : columns === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className={`grid gap-px overflow-hidden rounded-2xl border border-line bg-line ${cols}`}>
      {stats.map((stat) => {
        const body = (
          <>
            <p className="text-[14px] font-semibold text-ink">{stat.label}</p>
            <p className={`mt-3 text-[clamp(26px,3vw,34px)] leading-none font-semibold tracking-[-0.03em] tabular-nums ${toneClass[stat.tone ?? "default"]}`}>
              {stat.value.toLocaleString("en-IN")}
            </p>
            {stat.hint ? <p className="mt-2 text-[13px] text-[#171717]/70">{stat.hint}</p> : null}
          </>
        );
        return stat.href ? (
          <Link
            key={stat.label}
            href={stat.href}
            className="group bg-white p-5 transition-colors hover:bg-[#FBFBFA] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary sm:p-6"
          >
            {body}
          </Link>
        ) : (
          <div key={stat.label} className="bg-white p-5 sm:p-6">
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** Single stat in the same style as StatGroup, for places that need one. */
export function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return <StatGroup stats={[{ label, value, hint }]} columns={2} />;
}

/** Consistent card wrapper used on the business detail page. */
export function AdminCard({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-5 sm:p-6 ${className ?? ""}`}>
      {title ? (
        <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-line pb-3">
          <h2 className="text-[16px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Compact full-width activity strip with 3 stats. */
export function ActivityStatStrip({
  activity,
}: {
  activity?: { sales: number; purchases: number; payments: number } | null;
}) {
  if (!activity) {
    return (
      <AdminCard title="Last 30 days">
        <p className="text-[14px] text-[#171717]/70">No activity yet.</p>
      </AdminCard>
    );
  }
  return (
    <div>
      <AdminSectionTitle title="Last 30 days" />
      <StatGroup
        columns={3}
        stats={[
          { label: "Sales", value: activity.sales },
          { label: "Purchases", value: activity.purchases },
          { label: "Payments", value: activity.payments },
        ]}
      />
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
        className="btn-ghost inline-flex items-center gap-1"
      >
        More
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)} aria-hidden />
            <div
              role="menu"
              className="fixed z-[201] min-w-[10.5rem] rounded-lg border border-[#E5E5E5] bg-white py-1 shadow-lg"
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
                  className={`w-full px-3 py-2 text-left text-[13px] transition-colors disabled:opacity-50 ${
                    item.danger ? "text-[#a12b1f] hover:bg-[#faf5f2]" : "text-[#171717] hover:bg-[#F8F8F7]"
                  } ${i > 0 ? "border-t border-[#E5E5E5]" : ""}`}
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
      <p className="text-xs font-medium text-[#171717]/60 mb-1">{label}</p>
      <div className="text-sm text-[#171717] leading-snug break-words">{children}</div>
    </div>
  );
}

export function PasswordReveal({ password }: { password: string | null }) {
  const [show, setShow] = useState(false);
  if (!password) {
    return <span className="text-[13px] text-[#171717]/70">Not stored - reset to set one</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[13px] text-[#171717] tabular-nums">
        {show ? password : "•".repeat(10)}
      </span>
      <button
        type="button"
        className="btn-ghost !py-0.5 !px-2 text-[12px] min-h-0"
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
  const router = useRouter();

  const onRowKey = (e: React.KeyboardEvent, href: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(href);
    }
  };

  return (
    <>
      <ul className="space-y-3 lg:hidden">
        {owners.map((owner) => {
          const subActive = isSubscriptionLive(owner.business);
          const href = `/admin/businesses/${owner.id}`;
          return (
            <li key={owner.id}>
              <Link
                href={href}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-white p-4 transition-colors hover:bg-[#FBFBFA]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-ink">{owner.business.name}</p>
                  <p className="text-[13px] text-[#171717]/70 truncate">/{owner.business.slug}</p>
                  <p className="text-[13px] text-[#171717]/70 mt-1 truncate">{owner.email}</p>
                  <p className="text-[13px] font-medium text-[#171717] mt-1 truncate">{planFor(owner)}</p>
                  <SubscriptionExpHint business={owner.business} />
                </div>
                <BusinessStatusBadge
                  ownerActive={owner.active}
                  subscriptionActive={subActive}
                  subscriptionStatus={owner.business.subscriptionStatus}
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-hidden rounded-2xl border border-line bg-white lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-line bg-white">
                <th className="px-4 py-3 text-[13px] font-semibold normal-case tracking-normal text-ink text-left">
                  Business
                </th>
                <th className="px-4 py-3 text-[13px] font-semibold normal-case tracking-normal text-ink text-left">
                  Email
                </th>
                <th className="px-4 py-3 text-[13px] font-semibold normal-case tracking-normal text-ink text-left">
                  Subscription
                </th>
                <th className="px-4 py-3 text-[13px] font-semibold normal-case tracking-normal text-ink text-right">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {owners.map((owner) => {
                const subActive = isSubscriptionLive(owner.business);
                const href = `/admin/businesses/${owner.id}`;
                return (
                  <tr
                    key={owner.id}
                    className="group cursor-pointer transition-colors hover:bg-[#FBFBFA]"
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(href)}
                    onKeyDown={(e) => onRowKey(e, href)}
                  >
                    <td className="px-4 py-3 align-middle">
                      <p className="truncate text-[15px] font-bold text-ink">{owner.business.name}</p>
                      <p className="text-[13px] text-[#171717]/70 mt-0.5 truncate">/{owner.business.slug}</p>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <p className="text-sm text-[#171717]/70 truncate">{owner.email}</p>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <p className="text-sm font-medium text-[#171717]">{planFor(owner)}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <BusinessStatusBadge
                          ownerActive={owner.active}
                          subscriptionActive={subActive}
                          subscriptionStatus={owner.business.subscriptionStatus}
                        />
                        <SubscriptionExpHint business={owner.business} />
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      <span className="text-[13px] font-semibold text-ink underline decoration-[#171717]/25 underline-offset-4 group-hover:decoration-[#171717]">Open</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-3 border-b border-[#E5E5E5] last:border-b-0">
      <p className="text-xs font-medium text-[#171717]/60 mb-1">{label}</p>
      <div className="text-sm text-[#171717] break-words">{children}</div>
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
          label: revoking ? "Revoking ..." : "Revoke login",
          onClick: onRevoke,
          danger: true,
          disabled: revoking,
        },
      ]
    : [
        { label: "Reset password", onClick: onResetPassword },
        {
          label: reactivating ? "Reactivating ..." : "Reactivate login",
          onClick: onReactivate,
          disabled: reactivating,
        },
      ];

  return (
    <article className={`rounded-xl border border-[#E5E5E5] bg-white p-3 sm:p-4 ${owner.active ? "" : "opacity-75"}`}>
      <div className="mb-3 pb-3 border-b border-[#E5E5E5]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <h3 className="text-[13px] sm:text-sm font-semibold tracking-tight truncate">
              {owner.business.name}
            </h3>
            <StatusBadge active={owner.active} />
            <SubBadge active={subActive} status={owner.business.subscriptionStatus} />
          </div>
          <p className="font-mono text-xs sm:text-xs text-[#171717]/70">
            /{owner.business.slug}
            <span className="text-[#171717]/30 mx-1.5">·</span>
            Since {fmtDate(owner.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <InfoCell label="Owner account">
          <p className="font-medium text-[13px] text-[#171717]">{owner.name}</p>
          <p className="font-mono text-xs text-[#171717]/70 truncate mt-0.5">{owner.email}</p>
        </InfoCell>

        <InfoCell label="Subscription">
          <p className="font-medium text-[#171717]">{plan}</p>
          <p className="text-xs text-[#171717]/70 mt-0.5">
            <SubscriptionExpHint business={owner.business} />
          </p>
          {templateTags.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {templateTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex rounded-full bg-[#F8F8F7] px-1.5 py-0.5 text-xs text-[#171717]/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#171717]/70 mt-1">No templates</p>
          )}
        </InfoCell>

        <InfoCell label="Activity · 30 days">
          {activity ? (
            <div className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums text-xs">
              <span><span className="font-semibold text-[#171717]">{activity.sales}</span> sales</span>
              <span><span className="font-semibold text-[#171717]">{activity.purchases}</span> purchases</span>
              <span><span className="font-semibold text-[#171717]">{activity.payments}</span> payments</span>
            </div>
          ) : (
            <span className="text-[#171717]/70">No data yet</span>
          )}
        </InfoCell>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1.5 mt-3 pt-3 border-t border-[#E5E5E5]">
        <button
          type="button"
          className="btn-ghost !py-1 !px-2.5 text-xs min-h-0"
          onClick={onSubscription}
        >
          Subscription
        </button>
        <button
          type="button"
          className="btn-ghost !py-1 !px-2.5 text-xs min-h-0"
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
    <section className="rounded-lg border border-[#E5E5E5] bg-[#FAFAF9] p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-[13px] font-semibold text-[#171717]">{title}</h3>
        {description ? <p className="text-[12px] text-[#171717]/70 mt-1 leading-relaxed">{description}</p> : null}
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
  onCreated: (owner: OwnerAccount) => void;
}) {
  const defaultPlanId = activeSubscriptionPlans(subscriptionPlans)[0]?.id ?? "sub_monthly";
  const [form, setForm] = useState({
    businessName: "",
    name: "",
    email: "",
    password: "",
    subscriptionPlanId: defaultPlanId,
    templateIds: [] as string[],
    logoUrl: "",
  });
  // The select can show a plan that is not the one in state when plans load after mount.
  const planIdInUse = activeSubscriptionPlans(subscriptionPlans).some((plan) => plan.id === form.subscriptionPlanId)
    ? form.subscriptionPlanId
    : defaultPlanId;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  const close = () => {
    if (pending) return;
    setForm({
      businessName: "",
      name: "",
      email: "",
      password: "",
      subscriptionPlanId: defaultPlanId,
      templateIds: [],
      logoUrl: "",
    });
    setError(null);
    setLogoError(null);
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

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("This image is larger than 8 MB. Choose a smaller file.");
      if (logoInput.current) logoInput.current.value = "";
      return;
    }
    setLogoBusy(true);
    setLogoError(null);
    try {
      const payload = new FormData();
      payload.append("logo", file);
      const upload = await uploadBusinessLogoAction(payload);
      if (!upload.ok) return setLogoError(upload.error);
      setForm((current) => ({ ...current, logoUrl: upload.url }));
    } catch {
      setLogoError("Could not upload that image. Try again.");
    } finally {
      setLogoBusy(false);
      if (logoInput.current) logoInput.current.value = "";
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending || logoBusy) return;
    setPending(true);
    setError(null);
    try {
      const result = await createOwnerAction({ ...form, subscriptionPlanId: planIdInUse, logoUrl: form.logoUrl || undefined });
      if (!result.ok) return setError(result.error);
      // The create response is the full owner row, so the list updates without a refetch.
      onCreated(result.owner);
      setPending(false);
      close();
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      busy={pending}
      title="Register business owner"
      subtitle="Set up login, subscription, and optional catalogue templates. The owner adds their logo later in Settings."
      size="lg"
      footer={
        <div className="flex flex-col gap-3">
          {error && (
            <p role="alert" className="text-sm text-[#a12b1f] rounded-md border border-[#f0d2cc] bg-[#fdf1ef] px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <button type="button" className="btn-ghost w-full sm:w-auto" onClick={close}>
              Cancel
            </button>
            <BusyButton type="submit" form="register-owner-form" loading={pending} className="w-full sm:w-auto">
              Create owner account
            </BusyButton>
          </div>
        </div>
      }
    >
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
          <div>
            <label htmlFor="owner-logo">
              Logo <span className="normal-case tracking-normal text-[#171717]/70">(optional)</span>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              {form.logoUrl ? (
                <img
                  src={form.logoUrl}
                  alt="Business logo preview"
                  className="h-14 w-14 rounded-md border border-[#E5E5E5] bg-white object-contain"
                />
              ) : null}
              <input
                ref={logoInput}
                id="owner-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => void pickLogo(event.target.files?.[0])}
              />
              <button
                type="button"
                className="btn-ghost min-h-11"
                disabled={logoBusy || pending}
                onClick={() => logoInput.current?.click()}
              >
                {logoBusy ? "Uploading..." : form.logoUrl ? "Change logo" : "Upload logo"}
              </button>
              {form.logoUrl && !logoBusy ? (
                <button
                  type="button"
                  className="btn-ghost min-h-11"
                  disabled={pending}
                  onClick={() => setForm((current) => ({ ...current, logoUrl: "" }))}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <p className="text-xs text-[#171717]/70 mt-1.5">
              PNG, JPEG or WebP. Shown on the owner panel and printed bills. The owner can change it later in Settings.
            </p>
            {logoError && (
              <p role="alert" className="text-[12px] text-[#a12b1f] mt-1.5">{logoError}</p>
            )}
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
                className="text-xs font-medium text-[#171717]/70 hover:text-[#171717] underline underline-offset-2"
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
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            />
            <p className="text-xs text-[#171717]/70 mt-1.5">Copy this before creating - it cannot be retrieved later.</p>
          </div>
        </AdminFormSection>

        <AdminFormSection title="Subscription & catalogue">
          <div>
            <label htmlFor="owner-plan">Subscription plan</label>
            <select
              id="owner-plan"
              value={planIdInUse}
              onChange={(e) => setForm((f) => ({ ...f, subscriptionPlanId: e.target.value }))}
            >
              {activeSubscriptionPlans(subscriptionPlans).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.label}
                </option>
              ))}
            </select>
            {(() => {
              const plan = subscriptionPlans.find((p) => p.id === planIdInUse);
              if (!plan) return null;
              return (
                <p className="flex flex-wrap items-center gap-2 text-xs text-[#171717]/70 mt-2">
                  <span>Billing type:</span>
                  <BillingCycleBadge cycle={plan.billingCycle} durationDays={plan.durationDays} />
                </p>
              );
            })()}
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Product templates (optional)</p>
            <p className="text-xs text-[#171717]/70 mb-3">
              Pre-build catalogue on first login - steel, cement, wire, paint, tiles, etc.
            </p>
            {templates.length === 0 ? (
              <p className="text-[12px] text-[#171717]/60 rounded-md border border-dashed border-[#E5E5E5] px-3 py-4 text-center">
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
    if (pending) return;
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
    }).finally(() => setPending(false));
    if (!result.ok) return setError(result.error);
    await onUpdated();
    close();
  };

  return (
    <Modal open={Boolean(owner)} onClose={close} busy={pending} title={`Subscription - ${owner?.business.name ?? ""}`}>
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
        {error && <p role="alert" className="text-sm text-[#a12b1f]">{error}</p>}
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
    if (pending) return;
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
    const result = await applyOwnerTemplatesAction(owner.id, selected).finally(() => setPending(false));
    if (!result.ok) return setError(result.error);
    await onUpdated();
    close();
  };

  const assigned = owner?.business.assignedTemplateIds ?? [];

  return (
    <Modal open={Boolean(owner)} onClose={close} busy={pending} title={`Product templates - ${owner?.business.name ?? ""}`} size="lg">
      <p className="text-xs text-[#171717]/70 mb-4">
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
        {error && <p role="alert" className="text-sm text-[#a12b1f]">{error}</p>}
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
    if (pending) return;
    setPassword("");
    setError(null);
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!owner || pending) return;
    setPending(true);
    const result = await updateOwnerAction(owner.id, { password }).finally(() => setPending(false));
    if (!result.ok) return setError(result.error);
    await onUpdated();
    close();
  };

  return (
    <Modal open={Boolean(owner)} onClose={close} busy={pending} title={`Reset password - ${owner?.name ?? ""}`}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div>
          <label htmlFor="reset-password">New password</label>
          <input
            id="reset-password"
            type="text"
            value={password}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error && <p role="alert" className="text-sm text-[#a12b1f]">{error}</p>}
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

function EditOwnerForm({ owner, onUpdated, onClose, pending, setPending }: {
  owner: OwnerAccount;
  onUpdated: () => Promise<void>;
  onClose: () => void;
  pending: boolean;
  setPending: (value: boolean) => void;
}) {
  const [businessName, setBusinessName] = useState(owner.business.name);
  const [ownerName, setOwnerName] = useState(owner.name);
  const [ownerEmail, setOwnerEmail] = useState(owner.email);
  const [error, setError] = useState<string | null>(null);

  const businessNameRef = useRef<HTMLInputElement>(null);
  const ownerNameRef = useRef<HTMLInputElement>(null);
  const ownerEmailRef = useRef<HTMLInputElement>(null);

  const close = () => {
    if (pending) return;
    setError(null);
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const trimmedBusiness = businessName.trim();
    const trimmedOwner = ownerName.trim();
    const trimmedEmail = ownerEmail.trim();
    if (trimmedBusiness.length < 2 || trimmedBusiness.length > 80) {
      setError("Business name must be 2 to 80 characters.");
      businessNameRef.current?.focus();
      return;
    }
    if (trimmedOwner.length < 2 || trimmedOwner.length > 80) {
      setError("Owner name must be 2 to 80 characters.");
      ownerNameRef.current?.focus();
      return;
    }
    if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      setError("Enter a valid email address.");
      ownerEmailRef.current?.focus();
      return;
    }
    const input: { name?: string; email?: string; businessName?: string } = {};
    if (trimmedBusiness !== owner.business.name) input.businessName = trimmedBusiness;
    if (trimmedOwner !== owner.name) input.name = trimmedOwner;
    if (trimmedEmail !== owner.email) input.email = trimmedEmail;
    if (Object.keys(input).length === 0) {
      close();
      return;
    }
    setPending(true);
    const result = await updateOwnerAction(owner.id, input).finally(() => setPending(false));
    if (!result.ok) return setError(result.error);
    await onUpdated();
    close();
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <div>
        <label htmlFor="edit-business-name">Business name</label>
        <input
          id="edit-business-name"
          type="text"
          value={businessName}
          autoComplete="off"
          onChange={(event) => setBusinessName(event.target.value)}
          ref={businessNameRef}
        />
        <p className="text-[13px] text-[#171717]/70 mt-1.5">The business link stays /{owner.business.slug ?? ""}.</p>
      </div>
      <div>
        <label htmlFor="edit-owner-name">Owner name</label>
        <input id="edit-owner-name" type="text" value={ownerName} autoComplete="off" onChange={(event) => setOwnerName(event.target.value)} ref={ownerNameRef} />
      </div>
      <div>
        <label htmlFor="edit-owner-email">Owner email</label>
        <input
          id="edit-owner-email"
          type="email"
          value={ownerEmail}
          autoComplete="off"
          onChange={(event) => setOwnerEmail(event.target.value)}
          ref={ownerEmailRef}
        />
        <p className="text-[13px] text-[#171717]/70 mt-1.5">The owner signs in with this email. Changing it does not sign them out.</p>
      </div>
      {error && <p role="alert" className="text-sm text-[#a12b1f]">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
        <BusyButton type="submit" loading={pending}>
          Save
        </BusyButton>
      </div>
    </form>
  );
}

export function EditOwnerModal({
  owner,
  onClose,
  onUpdated,
}: {
  owner: OwnerAccount | null;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  const close = () => {
    if (pending) return;
    onClose();
  };

  return (
    <Modal open={Boolean(owner)} onClose={close} busy={pending} title={`Edit - ${owner?.business.name ?? ""}`}>
      {owner ? <EditOwnerForm key={owner.id} owner={owner} onUpdated={onUpdated} onClose={close} pending={pending} setPending={setPending} /> : null}
    </Modal>
  );
}
