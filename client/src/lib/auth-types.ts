export type TijarattRole = "SUPERADMIN" | "ADMIN" | "SUBADMIN";

import type { BusinessPanelPage, StaffPage } from "./staff-access";

export type { StaffPage, BusinessPanelPage };

export type TijarattUser = {
  id: string;
  email: string;
  name: string;
  role: TijarattRole;
  title: string | null;
  access: StaffPage[];
  planPages: BusinessPanelPage[];
  businessId: string;
  businessName: string;
  businessSlug: string;
};

export function roleLabel(role: TijarattRole, title?: string | null): string {
  if (role === "SUPERADMIN") return "Super Admin";
  if (role === "SUBADMIN") return title?.trim() || "Staff";
  return "Business owner";
}

export function displayName(user: Pick<TijarattUser, "name" | "role">): string {
  return user.role === "SUPERADMIN" ? "Super Admin" : user.name;
}
