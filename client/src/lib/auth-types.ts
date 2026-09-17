export type TradexRole = "SUPERADMIN" | "ADMIN" | "SUBADMIN";

import type { BusinessPanelPage, StaffPage } from "./staff-access";

export type { StaffPage, BusinessPanelPage };

export type TradexUser = {
  id: string;
  email: string;
  name: string;
  role: TradexRole;
  title: string | null;
  access: StaffPage[];
  planPages: BusinessPanelPage[];
  businessId: string;
  businessName: string;
  businessSlug: string;
};

export function roleLabel(role: TradexRole, title?: string | null): string {
  if (role === "SUPERADMIN") return "Super Admin";
  if (role === "SUBADMIN") return title?.trim() || "Staff";
  return "Business owner";
}

export function displayName(user: Pick<TradexUser, "name" | "role">): string {
  return user.role === "SUPERADMIN" ? "Super Admin" : user.name;
}
