import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { STAFF_PAGE_KEY } from "../decorators/require-staff-page.decorator";
import type { AuthUser } from "../decorators/current-user.decorator";
import type { BusinessPanelPage } from "../panel-access";
import { sanitizePlanPages } from "../panel-access";
import type { StaffPage } from "../staff-access";
import { sanitizeAccess } from "../staff-access";

@Injectable()
export class StaffAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<StaffPage[] | undefined>(
      STAFF_PAGE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) return true;

    if (user.role === "SUPERADMIN") return true;

    const planPages = new Set<BusinessPanelPage>(sanitizePlanPages(user.planPages));
    const planAllowed = required.some((page) => planPages.has(page as BusinessPanelPage));
    if (!planAllowed) {
      throw new ForbiddenException(
        "This feature is not included in your subscription plan",
      );
    }

    if (user.role === "ADMIN") return true;

    if (user.role !== "SUBADMIN") {
      throw new ForbiddenException("Your role cannot perform this action");
    }

    const allowed = new Set(sanitizeAccess(user.access));
    if (required.some((page) => allowed.has(page))) return true;

    throw new ForbiddenException("You do not have access to this feature");
  }
}
