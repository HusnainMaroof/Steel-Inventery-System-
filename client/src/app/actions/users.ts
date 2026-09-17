"use server";

import { tradexFetch, type TradexRole } from "@/lib/server/tradex";
import { sanitizeAccess, type StaffPage } from "@/lib/staff-access";
import type { SubscriptionPlan, SubscriptionStatus } from "./platform";

export type OwnerBusiness = {
  id: string;
  name: string;
  slug?: string;
  createdAt?: string;
  subscriptionPlan?: SubscriptionPlan | null;
  subscriptionStatus?: SubscriptionStatus | null;
  subscriptionStartsAt?: string | null;
  subscriptionEndsAt?: string | null;
  assignedTemplateIds?: string[];
  templatesAppliedAt?: string | null;
};

export type OwnerAccount = {
  id: string;
  email: string;
  name: string;
  role: TradexRole;
  active: boolean;
  loginPassword: string | null;
  createdAt?: string;
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

export async function listOwnersAction(): Promise<
  { ok: true; owners: OwnerAccount[] } | { ok: false; error: string }
> {
  const result = await tradexFetch<OwnerAccount[]>("/api/v1/owners");
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true, owners: result.data };
}

export async function createOwnerAction(input: {
  name: string;
  email: string;
  password: string;
  businessName: string;
  subscriptionPlan?: SubscriptionPlan;
  templateIds?: string[];
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
      subscriptionPlan: input.subscriptionPlan ?? "MONTHLY",
      templateIds: input.templateIds ?? [],
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
    plan?: SubscriptionPlan;
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

export async function removeOwnerAction(
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
  const result = await tradexFetch<StaffAccount[]>("/api/v1/users");
  if (!result.ok) return { ok: false, error: result.message };
  return {
    ok: true,
    staff: result.data.map((member) => ({
      ...member,
      access: sanitizeAccess(member.access),
    })),
  };
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
