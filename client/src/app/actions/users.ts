"use server";

import { tradexFetch, type TradexRole } from "@/lib/server/tradex";
import { sanitizeAccess, type StaffPage } from "@/lib/staff-access";
import type { BillingCycle, SubscriptionStatus } from "./platform";

export type OwnerBusiness = {
  id: string;
  name: string;
  slug?: string;
  createdAt?: string;
  subscriptionPlanId?: string | null;
  subscriptionPlanDef?: {
    id: string;
    label: string;
    billingCycle: BillingCycle;
    durationDays?: number | null;
    allowedPages?: string[];
  } | null;
  subscriptionStatus?: SubscriptionStatus | null;
  subscriptionStartsAt?: string | null;
  subscriptionEndsAt?: string | null;
  assignedTemplateIds?: string[];
  templatesAppliedAt?: string | null;
};

export type OwnerActivity30d = {
  sales: number;
  purchases: number;
  payments: number;
};

export type OwnerAccount = {
  id: string;
  email: string;
  name: string;
  role: TradexRole;
  active: boolean;
  createdAt?: string;
  subscriptionActive?: boolean;
  activity30d?: OwnerActivity30d;
  business: OwnerBusiness;
};

export type StaffAccount = {
  id: string;
  email: string;
  name: string;
  role: TradexRole;
  title: string | null;
  access: StaffPage[];
  createdAt?: string;
};

type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

async function fetchAllTradexPages<T>(path: string, limit = 100): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let pages = 1;
  do {
    const result = await tradexFetch<Paginated<T>>(`${path}?page=${page}&limit=${limit}`);
    if (!result.ok) throw new Error(result.message);
    items.push(...result.data.items);
    pages = result.data.pages;
    page += 1;
    if (page > 200) break;
  } while (page <= pages);
  return items;
}

export async function listOwnersAction(): Promise<
  { ok: true; owners: OwnerAccount[] } | { ok: false; error: string }
> {
  try {
    const owners = await fetchAllTradexPages<OwnerAccount>("/api/v1/owners");
    return { ok: true, owners };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to load owners",
    };
  }
}

export async function getOwnerAction(
  id: string,
): Promise<{ ok: true; owner: OwnerAccount } | { ok: false; error: string }> {
  const result = await tradexFetch<OwnerAccount>(`/api/v1/owners/${id}`);
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true, owner: result.data };
}

export async function createOwnerAction(input: {
  name: string;
  email: string;
  password: string;
  businessName: string;
  subscriptionPlanId?: string;
  templateIds?: string[];
  logoUrl?: string;
}): Promise<{ ok: true; owner: OwnerAccount } | { ok: false; error: string }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const businessName = input.businessName.trim();
  if (name.length < 2) return { ok: false, error: "Name must be at least 2 characters." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (businessName.length < 2) {
    return { ok: false, error: "Business name is required." };
  }
  const result = await tradexFetch<OwnerAccount>("/api/v1/owners", {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password: input.password,
      businessName,
      subscriptionPlanId: input.subscriptionPlanId,
      templateIds: input.templateIds ?? [],
      logoUrl: input.logoUrl,
    }),
  });
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true, owner: result.data };
}

export async function applyOwnerTemplatesAction(
  id: string,
  templateIds: string[],
): Promise<{ ok: true; owner: OwnerAccount } | { ok: false; error: string }> {
  if (!templateIds.length) {
    return { ok: false, error: "Select at least one product template." };
  }
  const result = await tradexFetch<OwnerAccount>(`/api/v1/owners/${id}/templates`, {
    method: "POST",
    body: JSON.stringify({ templateIds }),
  });
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true, owner: result.data };
}

export async function updateOwnerSubscriptionAction(
  id: string,
  input: {
    planId?: string;
    status?: SubscriptionStatus;
    endsAt?: string;
  },
): Promise<{ ok: true; owner: OwnerAccount } | { ok: false; error: string }> {
  const result = await tradexFetch<OwnerAccount>(`/api/v1/owners/${id}/subscription`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true, owner: result.data };
}

export async function deleteOwnerAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await tradexFetch<unknown>(`/api/v1/owners/${id}`, {
    method: "DELETE",
  });
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true };
}

export async function updateOwnerAction(
  id: string,
  input: { password?: string; active?: boolean },
): Promise<{ ok: true; owner: OwnerAccount } | { ok: false; error: string }> {
  if (input.password !== undefined && input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  const result = await tradexFetch<OwnerAccount>(`/api/v1/owners/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true, owner: result.data };
}

export async function listStaffAction(): Promise<
  { ok: true; staff: StaffAccount[] } | { ok: false; error: string }
> {
  try {
    const staff = await fetchAllTradexPages<StaffAccount>("/api/v1/users");
    return {
      ok: true,
      staff: staff.map((member) => ({
        ...member,
        access: sanitizeAccess(member.access),
      })),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to load staff",
    };
  }
}

export async function createStaffAction(input: {
  name: string;
  email: string;
  password: string;
  title: string;
  access: StaffPage[];
}): Promise<{ ok: true; staff: StaffAccount } | { ok: false; error: string }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const title = input.title.trim();
  const access = sanitizeAccess(input.access);
  if (name.length < 2) return { ok: false, error: "Name must be at least 2 characters." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (title.length < 2) return { ok: false, error: "Job title is required." };
  if (!access.length) return { ok: false, error: "Pick at least one page." };
  const result = await tradexFetch<StaffAccount>("/api/v1/users", {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password: input.password,
      title,
      access,
      role: "SUBADMIN",
    }),
  });
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true, staff: { ...result.data, access: sanitizeAccess(result.data.access) } };
}

export async function updateStaffAction(
  id: string,
  input: { name?: string; title?: string; access?: StaffPage[]; password?: string },
): Promise<{ ok: true; staff: StaffAccount } | { ok: false; error: string }> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name.trim();
  if (input.title !== undefined) body.title = input.title.trim();
  if (input.access !== undefined) body.access = sanitizeAccess(input.access);
  if (input.password) body.password = input.password;
  const result = await tradexFetch<StaffAccount>(`/api/v1/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true, staff: { ...result.data, access: sanitizeAccess(result.data.access) } };
}

export async function removeStaffAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await tradexFetch<unknown>(`/api/v1/users/${id}`, {
    method: "DELETE",
  });
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true };
}
