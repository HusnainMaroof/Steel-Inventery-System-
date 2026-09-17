"use server";

import { tradexFetch } from "@/lib/server/tradex";

export type BillingCycle = "MONTHLY" | "YEARLY" | "LIFETIME" | "CUSTOM_DAYS";
export type SubscriptionStatus = "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED";

export type BusinessPanelPage =
  | "dashboard"
  | "purchases"
  | "products"
  | "inventory"
  | "sales"
  | "customers"
  | "suppliers"
  | "payments"
  | "expenses"
  | "reports"
  | "staff"
  | "settings";

export type SubscriptionPlanOption = {
  id: string;
  label: string;
  billingCycle: BillingCycle;
  durationDays?: number | null;
  description?: string | null;
  price?: string | number | null;
  allowedPages: BusinessPanelPage[];
  active: boolean;
  sortOrder: number;
};

export type ProductTemplateOption = {
  id: string;
  label: string;
  usesCategories: boolean;
  productName: string;
  productUnit: string;
  custom?: boolean;
};

export type CatalogTemplateAttribute = {
  name: string;
  type: "text" | "number" | "select";
  required: boolean;
  unit?: string;
  options?: string[];
};

export type CatalogTemplateCategory = {
  name: string;
  description?: string;
  attributes: CatalogTemplateAttribute[];
};

export type ProductTemplateFull = {
  id: string;
  label: string;
  usesCategories: boolean;
  product: { name: string; unit: string; description?: string };
  attributes?: CatalogTemplateAttribute[];
  categories?: CatalogTemplateCategory[];
};

export type PlatformOverview = {
  totals: {
    businesses: number;
    owners: number;
    activeOwners: number;
    revokedOwners: number;
    sales30d: number;
    purchases30d: number;
    payments30d: number;
  };
  subscriptions: {
    active: number;
    expired: number;
    byPlan: {
      id: string;
      label: string;
      billingCycle: BillingCycle;
      count: number;
    }[];
  };
  recentActivity: {
    type: "sale" | "purchase";
    at: string;
    businessName: string;
    businessSlug: string;
    label: string;
    party: string;
  }[];
  businesses: {
    ownerId: string;
    ownerActive: boolean;
    businessId: string;
    businessName: string;
    businessSlug: string;
    subscriptionPlanId: string | null;
    subscriptionPlanLabel: string;
    subscriptionPlan: {
      id: string;
      label: string;
      billingCycle: BillingCycle;
    } | null;
    subscriptionStatus: SubscriptionStatus | null;
    subscriptionActive: boolean;
    subscriptionStartsAt: string | null;
    subscriptionEndsAt: string | null;
    assignedTemplateIds: string[];
    activity30d: { sales: number; purchases: number; payments: number };
  }[];
};

export async function getPlatformOverviewAction(): Promise<
  { ok: true; overview: PlatformOverview } | { ok: false; error: string }
> {
  const result = await tradexFetch<PlatformOverview>("/api/v1/platform/overview");
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true, overview: result.data };
}

export async function listProductTemplatesAction(): Promise<
  { ok: true; templates: ProductTemplateOption[] } | { ok: false; error: string }
> {
  const result = await tradexFetch<ProductTemplateOption[]>("/api/v1/platform/templates");
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true, templates: result.data };
}

export async function listProductTemplatesFullAction(): Promise<
  { ok: true; templates: ProductTemplateFull[] } | { ok: false; error: string }
> {
  const result = await tradexFetch<ProductTemplateFull[]>("/api/v1/platform/templates/full");
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true, templates: result.data };
}

export async function createCatalogTemplateAction(input: {
  label: string;
  productName: string;
  productUnit: string;
  description?: string;
  attributes: CatalogTemplateAttribute[];
}): Promise<{ ok: true; template: ProductTemplateFull } | { ok: false; error: string }> {
  const label = input.label.trim();
  const productName = input.productName.trim();
  const productUnit = input.productUnit.trim();
  if (label.length < 2) return { ok: false, error: "Template label is required." };
  if (!productName) return { ok: false, error: "Product name is required." };
  if (!productUnit) return { ok: false, error: "Product unit is required." };
  if (!input.attributes.length) {
    return { ok: false, error: "Add at least one attribute." };
  }
  const result = await tradexFetch<ProductTemplateFull>("/api/v1/platform/templates", {
    method: "POST",
    body: JSON.stringify({
      label,
      productName,
      productUnit,
      description: input.description?.trim() || undefined,
      usesCategories: false,
      attributes: input.attributes,
    }),
  });
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true, template: result.data };
}

export async function listSubscriptionPlansAction(
  includeInactive = false,
): Promise<{ ok: true; plans: SubscriptionPlanOption[] } | { ok: false; error: string }> {
  const query = includeInactive ? "?all=1" : "";
  const result = await tradexFetch<SubscriptionPlanOption[]>(
    `/api/v1/platform/subscription-plans${query}`,
  );
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true, plans: result.data };
}

export async function createSubscriptionPlanAction(input: {
  label: string;
  billingCycle: BillingCycle;
  durationDays?: number;
  description?: string;
  price?: number;
  sortOrder?: number;
  allowedPages: BusinessPanelPage[];
}): Promise<{ ok: true; plan: SubscriptionPlanOption } | { ok: false; error: string }> {
  if (!input.allowedPages?.length) {
    return { ok: false, error: "Select at least one business panel module." };
  }
  const result = await tradexFetch<SubscriptionPlanOption>("/api/v1/platform/subscription-plans", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true, plan: result.data };
}

export async function updateSubscriptionPlanAction(
  id: string,
  input: {
    label?: string;
    billingCycle?: BillingCycle;
    durationDays?: number;
    description?: string;
    price?: number;
    sortOrder?: number;
    active?: boolean;
    allowedPages?: BusinessPanelPage[];
  },
): Promise<{ ok: true; plan: SubscriptionPlanOption } | { ok: false; error: string }> {
  const result = await tradexFetch<SubscriptionPlanOption>(`/api/v1/platform/subscription-plans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true, plan: result.data };
}
