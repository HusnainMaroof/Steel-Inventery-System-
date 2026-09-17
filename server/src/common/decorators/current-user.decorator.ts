import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { BusinessPanelPage } from "../panel-access";
import type { StaffPage } from "../staff-access";
import type { UserRole } from "../types/jwt-payload";

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string;
  businessSlug?: string;
  tokenVersion?: number;
  access?: StaffPage[];
  planPages?: BusinessPanelPage[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user as AuthUser;
  },
);
