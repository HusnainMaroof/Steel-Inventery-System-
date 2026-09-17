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
  planPagesSummary,
} from "@/lib/staff-access";
import { BusyButton, Modal } from "@/components/ui";

const BILLING_OPTIONS: { value: BillingCycle; label: string }[] = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "LIFETIME", label: "Lifetime (no expiry)" },
  { value: "CUSTOM_DAYS", label: "Custom number of days" },
];

const DEFAULT_PAGES = allBusinessPanelPages();

export function billingCycleLabel(cycle: BillingCycle) {
  return BILLING_OPTIONS.find((option) => option.value === cycle)?.label ?? cycle;
}

export function SubscriptionPlanTable({
  plans,
  onEdit,
}: {
  plans: SubscriptionPlanOption[];
  onEdit: (plan: SubscriptionPlanOption) => void;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/80">
              <th className="px-4 py-2.5 text-[10px] uppercase tracking-[0.1em] font-medium text-neutral-500">Plan</th>
              <th className="px-4 py-2.5 text-[10px] uppercase tracking-[0.1em] font-medium text-neutral-500">Billing</th>
              <th className="px-4 py-2.5 text-[10px] uppercase tracking-[0.1em] font-medium text-neutral-500">Modules</th>
              <th className="px-4 py-2.5 text-[10px] uppercase tracking-[0.1em] font-medium text-neutral-500">Price</th>
              <th className="px-4 py-2.5 text-[10px] uppercase tracking-[0.1em] font-medium text-neutral-500">Status</th>
              <th className="px-4 py-2.5 text-[10px] uppercase tracking-[0.1em] font-medium text-neutral-500 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {plans.map((plan) => (
              <tr key={plan.id} className={plan.active ? "" : "opacity-60"}>
                <td className="px-4 py-3">
                  <p className="text-[13px] font-semibold text-neutral-900">{plan.label}</p>
                  {plan.description ? (
                    <p className="text-[11px] text-neutral-500 mt-0.5">{plan.description}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-[12px] text-neutral-700">
                  {billingCycleLabel(plan.billingCycle)}
                  {plan.billingCycle === "CUSTOM_DAYS" && plan.durationDays
                    ? ` · ${plan.durationDays} days`
                    : ""}
                </td>
                <td className="px-4 py-3 text-[11px] text-neutral-600 max-w-xs">
                  {planPagesSummary(plan.allowedPages)}
                </td>
                <td className="px-4 py-3 text-[12px] tabular-nums text-neutral-700">
                  {plan.price != null && plan.price !== "" ? plan.price : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      plan.active ? "bg-emerald-50 text-emerald-800" : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {plan.active ? "Active" : "Hidden"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="btn-ghost !py-1.5 !px-3 text-[12px]" onClick={() => onEdit(plan)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    if (!allowedPages.length) {
      setError("Select at least one business panel module.");
      return;
    }
    setPending(true);
    const payload = {
      label,
      billingCycle,
      durationDays: billingCycle === "CUSTOM_DAYS" ? Number(durationDays) : undefined,
      description,
      price: price.trim() ? Number(price) : undefined,
      sortOrder: Number(sortOrder) || 0,
      active,
      allowedPages,
    };
    const result = plan
      ? await updateSubscriptionPlanAction(plan.id, payload)
      : await createSubscriptionPlanAction(payload);
    setPending(false);
    if (!result.ok) return setError(result.error);
    await onSaved();
    close();
  };

  return (
    <Modal open={open} onClose={close} title={plan ? `Edit — ${plan.label}` : "New subscription plan"} size="lg">
      {error ? <p role="alert" className="text-sm text-[#a12b1f] mb-3">{error}</p> : null}
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div>
          <label htmlFor="plan-label">Plan name</label>
          <input id="plan-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Quarterly" />
        </div>
        <div>
          <label htmlFor="plan-billing">Billing cycle</label>
          <select
            id="plan-billing"
            value={billingCycle}
            onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
          >
            {BILLING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="plan-price">Price (optional)</label>
            <input id="plan-price" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label htmlFor="plan-sort">Sort order</label>
            <input id="plan-sort" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-1">Business panel modules</p>
          <p className="text-xs text-neutral-500 mb-3">
            Choose which sidebar tabs businesses on this plan can access.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allBusinessPanelPages().map((page) => (
              <label
                key={page}
                className={`flex items-center gap-2.5 border rounded-md px-3 py-2.5 cursor-pointer text-[13px] ${
                  allowedPages.includes(page) ? "border-black bg-neutral-50" : "border-neutral-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={allowedPages.includes(page)}
                  onChange={() => togglePage(page)}
                />
                {panelPageLabel(page)}
              </label>
            ))}
          </div>
        </div>

        {plan ? (
          <label className="flex items-center gap-2 text-[13px] text-neutral-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active (shown when registering businesses)
          </label>
        ) : null}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
          <BusyButton type="submit" loading={pending}>{plan ? "Save plan" : "Create plan"}</BusyButton>
        </div>
      </form>
    </Modal>
  );
}
