import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { UserRole } from "../types/jwt-payload";

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user as AuthUser;
  },
);
