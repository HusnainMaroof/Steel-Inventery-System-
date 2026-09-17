export type TradexRole = "SUPERADMIN" | "ADMIN" | "SUBADMIN";

export type StaffPage =
  | "dashboard"
  | "purchases"
  | "products"
  | "inventory"
  | "sales"
  | "customers"
  | "suppliers"
  | "payments"
  | "expenses"
  | "reports";

export type TradexUser = {
  id: string;
  email: string;
  name: string;
  role: TradexRole;
  title: string | null;
  access: StaffPage[];
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
