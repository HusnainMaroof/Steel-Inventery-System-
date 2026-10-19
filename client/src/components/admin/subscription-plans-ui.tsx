"use client";

import { useEffect, useState } from "react";
import {
  createSubscriptionPlanAction,
  updateSubscriptionPlanAction,
  type BillingCycle,
  type BusinessPanelPage,
  type SubscriptionPlanOption,
} from "@/app/actions/platform";
import {
  allBusinessPanelPages,
  panelPageLabel,
  sanitizePlanPages,
} from "@/lib/staff-access";
import {
  BILLING_CYCLES,
  BILLING_CYCLE_META,
  billingCycleMeta,
} from "@/lib/admin-platform-meta";
import { fmtMoney } from "@/lib/format";
import { BusyButton, Modal, RowActionsMenu, type RowActionsMenuItem } from "@/components/ui";

const DEFAULT_PAGES = allBusinessPanelPages();
const ALL_PAGES = allBusinessPanelPages();

/** Human readable billing description used in the table next to the pill. */
export function billingCycleText(cycle: BillingCycle, durationDays?: number | null): string {
  switch (cycle) {
    case "MONTHLY":
      return "Every month";
    case "YEARLY":
      return "Every year";
    case "LIFETIME":
      return "No expiry";
    case "CUSTOM_DAYS":
      return durationDays && durationDays > 0 ? `Every ${durationDays} days` : "Every custom days";
    default:
      return billingCycleMeta(cycle).short;
  }
}

/** Price display: formatted money or a muted "Not set". */
export function planPrice(plan: SubscriptionPlanOption): string {
  const raw = plan.price;
  if (raw == null || raw === "") return "Not set";
  const num = typeof raw === "string" ? Number(raw) : raw;
  return Number.isFinite(num) ? fmtMoney(num) : "Not set";
}

/** Modules summary for the table: "All modules" or "{n} of {total} modules". */
export function modulesSummary(plan: SubscriptionPlanOption): {
  label: string;
  missing: BusinessPanelPage[];
  full: string;
} {
  const pages = sanitizePlanPages(plan.allowedPages);
  const total = ALL_PAGES.length;
  if (pages.length === total) {
    return { label: "All modules", missing: [], full: "All modules" };
  }
  const missing = ALL_PAGES.filter((p) => !pages.includes(p));
  const full = pages.map(panelPageLabel).join(", ");
  return { label: `${pages.length} of ${total} modules`, missing, full };
}

export function billingCycleLabel(cycle: BillingCycle) {
  return billingCycleMeta(cycle).label;
}

export function BillingCycleBadge({
  cycle,
  durationDays,
}: {
  cycle: BillingCycle;
  durationDays?: number | null;
}) {
  const meta = billingCycleMeta(cycle);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-[#E5E5E5] bg-white px-2 py-0.5 text-xs font-medium text-[#171717]"
    >
      {meta.short}
      {cycle === "CUSTOM_DAYS" && durationDays ? ` · ${durationDays}d` : ""}
    </span>
  );
}

function BillingCyclePicker({
  value,
  onChange,
}: {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {BILLING_CYCLES.map((cycle) => {
        const meta = BILLING_CYCLE_META[cycle];
        const active = value === cycle;
        return (
          <button
            key={cycle}
            type="button"
            onClick={() => onChange(cycle)}
            className={`text-left rounded-lg border px-3.5 py-3 transition-colors ${
              active
                ? "border-[#171717] bg-[#F8F8F7] ring-1 ring-primary/20"
                : "border-[#E5E5E5] bg-white hover:border-[#c9c9c9]"
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-[#171717]">{meta.label}</span>
              <BillingCycleBadge cycle={cycle} />
            </span>
            <span className="block text-[13px] text-[#171717]/70 mt-1.5 leading-snug">{meta.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SubscriptionPlanTable({
  plans,
  onEdit,
  onToggle,
}: {
  plans: SubscriptionPlanOption[];
  onEdit: (plan: SubscriptionPlanOption) => void;
  onToggle: (plan: SubscriptionPlanOption) => Promise<void>;
}) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-[#E5E5E5] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="bg-[#FAFAF9] border-b border-[#E5E5E5]">
                <th className="px-4 py-2.5 text-xs uppercase tracking-wide text-[#171717]/60 font-medium">Plan</th>
                <th className="px-4 py-2.5 text-xs uppercase tracking-wide text-[#171717]/60 font-medium">Billing</th>
                <th className="px-4 py-2.5 text-xs uppercase tracking-wide text-[#171717]/60 font-medium">Modules</th>
                <th className="px-4 py-2.5 text-xs uppercase tracking-wide text-[#171717]/60 font-medium">Price</th>
                <th className="px-4 py-2.5 text-xs uppercase tracking-wide text-[#171717]/60 font-medium">Status</th>
                <th className="px-4 py-2.5 text-xs uppercase tracking-wide text-[#171717]/60 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {plans.map((plan) => {
                const m = modulesSummary(plan);
                return (
                  <tr
                    key={plan.id}
                    onClick={() => onEdit(plan)}
                    className="cursor-pointer hover:bg-[#F8F8F7]"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[#171717]">{plan.label}</p>
                      {plan.description ? (
                        <p className="text-[13px] text-[#171717]/70 mt-0.5">{plan.description}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BillingCycleBadge cycle={plan.billingCycle} durationDays={plan.durationDays} />
                        <span className="text-sm text-[#171717]">{billingCycleText(plan.billingCycle, plan.durationDays)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-xs" title={m.full}>
                      <p className="text-sm text-[#171717]">{m.label}</p>
                      {m.missing.length > 0 ? (
                        <p className="text-[13px] text-destructive/80">
                          No {m.missing.map(panelPageLabel).join(", ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#171717] tabular-nums">
                      {plan.price != null && plan.price !== "" ? (
                        <span className="text-[#171717]">{planPrice(plan)}</span>
                      ) : (
                        <span className="text-[#171717]/60">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill active={plan.active} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PlanRowActions plan={plan} onEdit={onEdit} onToggle={onToggle} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-3">
        {plans.map((plan) => {
          const m = modulesSummary(plan);
          const items = planMenuItems(plan, onEdit, onToggle);
          return (
            <li
              key={plan.id}
              className="rounded-xl border border-[#E5E5E5] bg-white p-4 cursor-pointer hover:bg-[#F8F8F7]"
              onClick={() => onEdit(plan)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#171717]">{plan.label}</p>
                  {plan.description ? (
                    <p className="text-[13px] text-[#171717]/70 mt-0.5 leading-snug">{plan.description}</p>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    plan.active ? "bg-success/10 text-success" : "bg-[#E5E5E5] text-[#171717]/60"
                  }`}
                >
                  {plan.active ? "Active" : "Hidden"}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[#171717]/60">Billing</dt>
                  <dd className="mt-1">
                    <div className="flex items-center gap-2">
                      <BillingCycleBadge cycle={plan.billingCycle} durationDays={plan.durationDays} />
                      <span className="text-[#171717]">{billingCycleText(plan.billingCycle, plan.durationDays)}</span>
                    </div>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[#171717]/60">Price</dt>
                  <dd className="mt-1 text-[#171717] tabular-nums">
                    {plan.price != null && plan.price !== "" ? planPrice(plan) : <span className="text-[#171717]/60">Not set</span>}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-[#171717]/60">Modules</dt>
                  <dd className="mt-1" title={m.full}>
                    <p className="text-[#171717]">{m.label}</p>
                    {m.missing.length > 0 ? (
                      <p className="text-[13px] text-destructive/80">
                        No {m.missing.map(panelPageLabel).join(", ")}
                      </p>
                    ) : null}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-[#171717]/60">Status</dt>
                  <dd className="mt-1">
                    <StatusPill active={plan.active} />
                  </dd>
                </div>
              </dl>
              <div
                className="mt-3 flex justify-end"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <RowActionsMenu items={items} ariaLabel={`Actions for ${plan.label}`} />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* Row action menu shared by desktop and mobile rows. */
function PlanRowActions({
  plan,
  onEdit,
  onToggle,
}: {
  plan: SubscriptionPlanOption;
  onEdit: (plan: SubscriptionPlanOption) => void;
  onToggle: (plan: SubscriptionPlanOption) => Promise<void>;
}) {
  return (
    <span
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <RowActionsMenu
        items={[
          { label: "Edit plan", onClick: () => onEdit(plan) },
          {
            label: plan.active ? "Hide plan" : "Show plan",
            onClick: () => onToggle(plan),
          },
        ]}
        ariaLabel={`Actions for ${plan.label}`}
      />
    </span>
  );
}

function planMenuItems(
  plan: SubscriptionPlanOption,
  onEdit: (plan: SubscriptionPlanOption) => void,
  onToggle: (plan: SubscriptionPlanOption) => Promise<void>,
): RowActionsMenuItem[] {
  return [
    { label: "Edit plan", onClick: () => onEdit(plan) },
    {
      label: plan.active ? "Hide plan" : "Show plan",
      onClick: () => onToggle(plan),
    },
  ];
}

/* Status pill: Active uses success tint; Hidden is muted with a hint line. */
function StatusPill({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-success/10 text-success">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-[#E5E5E5] text-[#171717]/60">
        Hidden
      </span>
      <span className="text-[13px] text-[#171717]/70">Not offered to new businesses</span>
    </span>
  );
}

export function SubscriptionPlanModal({
  open,
  plan,
  onClose,
  onSaved,
}: {
  open: boolean;
  plan: SubscriptionPlanOption | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [durationDays, setDurationDays] = useState("30");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [active, setActive] = useState(true);
  const [allowedPages, setAllowedPages] = useState<BusinessPanelPage[]>(DEFAULT_PAGES);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reset = (source: SubscriptionPlanOption | null) => {
    setLabel(source?.label ?? "");
    setBillingCycle(source?.billingCycle ?? "MONTHLY");
    setDurationDays(String(source?.durationDays ?? 30));
    setDescription(source?.description ?? "");
    setPrice(source?.price != null ? String(source.price) : "");
    setSortOrder(String(source?.sortOrder ?? 0));
    setActive(source?.active ?? true);
    setAllowedPages(source?.allowedPages?.length ? source.allowedPages : DEFAULT_PAGES);
    setError(null);
  };

  const close = () => {
    if (pending) return;
    reset(null);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    reset(plan);
  }, [open, plan]);

  const togglePage = (page: BusinessPanelPage) => {
    setAllowedPages((current) =>
      current.includes(page) ? current.filter((item) => item !== page) : [...current, page],
    );
  };

  const selectAll = () => setAllowedPages([...ALL_PAGES]);
  const clear = () => setAllowedPages([]);

  const selectedCount = allowedPages.length;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    // check here so the message sits next to the field instead of a raw server error
    const name = label.trim();
    if (name.length < 2) {
      setError("Enter a plan name (at least 2 characters).");
      document.getElementById("plan-label")?.focus();
      return;
    }
    const days = Number(durationDays);
    if (billingCycle === "CUSTOM_DAYS" && (!Number.isInteger(days) || days < 1)) {
      setError("Enter the number of days, 1 or more.");
      document.getElementById("plan-days")?.focus();
      return;
    }
    if (price.trim() && !(Number(price) >= 0)) {
      setError("Enter a valid price, or leave it empty.");
      document.getElementById("plan-price")?.focus();
      return;
    }
    if (!allowedPages.length) {
      setError("Select at least one module.");
      return;
    }
    setError(null);
    setPending(true);
    const payload = {
      label: name,
      billingCycle,
      durationDays: billingCycle === "CUSTOM_DAYS" ? days : undefined,
      description: description.trim(),
      price: price.trim() ? Number(price) : undefined,
      sortOrder: Number(sortOrder) || 0,
      active,
      allowedPages,
    };
    const result = await (plan
      ? updateSubscriptionPlanAction(plan.id, payload)
      : createSubscriptionPlanAction(payload)
    ).finally(() => setPending(false));
    if (!result.ok) return setError(result.error);
    await onSaved();
    close();
  };

  return (
    <Modal open={open} onClose={close} busy={pending} title={plan ? `Edit - ${plan.label}` : "New subscription plan"} size="lg">
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div>
          <label htmlFor="plan-label">Plan name</label>
          <input id="plan-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Quarterly" />
        </div>
        <div>
          <p className="text-sm font-medium mb-1">Billing type</p>
          <p className="text-[13px] text-[#171717]/70 mb-3">
            One of four cycles: monthly, yearly, lifetime, or custom days.
          </p>
          <BillingCyclePicker value={billingCycle} onChange={setBillingCycle} />
        </div>
        {billingCycle === "CUSTOM_DAYS" && (
          <div>
            <label htmlFor="plan-days">Duration (days)</label>
            <input
              id="plan-days"
              type="number"
              min={1}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
            />
          </div>
        )}
        <div>
          <label htmlFor="plan-desc">Description (optional)</label>
          <input id="plan-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="plan-price">Price (optional)</label>
            <input
              id="plan-price"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="Optional"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="plan-sort">Sort order</label>
            <input id="plan-sort" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-1">Business panel modules</p>
          <p className="text-[13px] text-[#171717]/70 mb-3">
            Choose which sidebar tabs businesses on this plan can access.
          </p>
          <div className="flex items-center gap-3 mb-2">
            <button type="button" className="btn-ghost" onClick={selectAll}>Select all</button>
            <button type="button" className="btn-ghost" onClick={clear}>Clear</button>
            <span className="text-[13px] text-[#171717]/70 ml-auto">
              {selectedCount} of {ALL_PAGES.length} modules selected
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_PAGES.map((page) => {
              const selected = allowedPages.includes(page);
              return (
                <label
                  key={page}
                  className="flex items-center justify-center h-10 cursor-pointer text-[13px]"
                  title={panelPageLabel(page)}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => togglePage(page)}
                    className="sr-only"
                    aria-label={panelPageLabel(page)}
                  />
                  <span
                    className={
                      selected
                        ? "inline-flex items-center justify-center h-10 px-3 rounded-lg bg-ink text-white text-[13px] font-medium"
                        : "inline-flex items-center justify-center h-10 px-3 rounded-lg border border-[#E5E5E5] bg-white text-[#171717] text-[13px] font-medium"
                    }
                  >
                    {panelPageLabel(page)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {plan ? (
          <label className="flex items-center gap-2 text-[13px] text-[#171717]">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active (shown when registering businesses)
          </label>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2.5 text-[13px] font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
          <BusyButton type="submit" loading={pending}>{plan ? "Save plan" : "Create plan"}</BusyButton>
        </div>
      </form>
    </Modal>
  );
}
