import type { BillingCycle } from "@/app/actions/platform";

/** The four subscription billing types Super Admin can assign. */
export const BILLING_CYCLES: BillingCycle[] = ["MONTHLY", "YEARLY", "LIFETIME", "CUSTOM_DAYS"];

export const BILLING_CYCLE_META: Record<
  BillingCycle,
  { label: string; short: string; hint: string; badgeClass: string }
> = {
  MONTHLY: {
    label: "Monthly",
    short: "Monthly",
    hint: "Renews every month — typical SaaS billing.",
    badgeClass: "bg-sky-50 text-sky-900 border-sky-100",
  },
  YEARLY: {
    label: "Yearly",
    short: "Yearly",
    hint: "One renewal per year — often discounted vs monthly.",
    badgeClass: "bg-violet-50 text-violet-900 border-violet-100",
  },
  LIFETIME: {
    label: "Lifetime",
    short: "Lifetime",
    hint: "No expiry — access does not end on a schedule.",
    badgeClass: "bg-emerald-50 text-emerald-900 border-emerald-100",
  },
  CUSTOM_DAYS: {
    label: "Custom days",
    short: "Custom",
    hint: "Trial or promo — you choose how many days it lasts.",
    badgeClass: "bg-amber-50 text-amber-900 border-amber-100",
  },
};

export function billingCycleMeta(cycle: BillingCycle) {
  return BILLING_CYCLE_META[cycle];
}

export type BuiltinTemplateMeta = {
  trade: string;
  hint: string;
  accentClass: string;
};

/** Built-in catalogue trade types (steel, cement, wire, paint, tiles). */
export const BUILTIN_TEMPLATE_META: Record<string, BuiltinTemplateMeta> = {
  "tpl-steel": {
    trade: "Steel",
    hint: "Size, grade & mill — one product, flat attributes",
    accentClass: "border-l-[#171717]",
  },
  "tpl-cement": {
    trade: "Cement",
    hint: "Grey & white cement — separate categories",
    accentClass: "border-l-stone-500",
  },
  "tpl-wire": {
    trade: "Wire",
    hint: "Binding & G.I. wire by gauge",
    accentClass: "border-l-zinc-600",
  },
  "tpl-paint": {
    trade: "Paint",
    hint: "Wall paint & enamel lines",
    accentClass: "border-l-rose-400",
  },
  "tpl-tiles": {
    trade: "Tiles",
    hint: "Floor & wall tiles by size & finish",
    accentClass: "border-l-orange-500",
  },
};

export function builtinTemplateMeta(templateId: string): BuiltinTemplateMeta | null {
  return BUILTIN_TEMPLATE_META[templateId] ?? null;
}

export function catalogStructureLabel(usesCategories: boolean) {
  return usesCategories ? "Categories" : "Flat attributes";
}
