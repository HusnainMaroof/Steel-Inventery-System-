import type { BusinessPanelPage } from "../panel-access";
import type { StaffPage } from "../staff-access";

export type UserRole = "SUPERADMIN" | "ADMIN" | "SUBADMIN";

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string;
  businessSlug: string;
  tokenVersion: number;
  access?: StaffPage[];
  planPages?: BusinessPanelPage[];
}
