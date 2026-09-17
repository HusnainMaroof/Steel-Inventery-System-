"use server";

import { tradexFetch } from "@/lib/server/tradex";

export type SubscriptionPlan = "MONTHLY" | "YEARLY" | "LIFETIME";
export type SubscriptionStatus = "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED";

export type ProductTemplateOption = {
  id: string;
  label: string;
  usesCategories: boolean;
  productName: string;
  productUnit: string;
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
    monthly: number;
    yearly: number;
    lifetime: number;
    expired: number;
    active: number;
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
    subscriptionPlan: SubscriptionPlan | null;
    subscriptionPlanLabel: string;
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
