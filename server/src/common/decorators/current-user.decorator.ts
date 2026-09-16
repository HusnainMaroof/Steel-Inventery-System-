import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  role: "ADMIN" | "SUBADMIN";
  businessId: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user as AuthUser;
  },
);
