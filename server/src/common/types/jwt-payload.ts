export type UserRole = "SUPERADMIN" | "ADMIN" | "SUBADMIN";

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string;
  businessSlug: string;
}
