import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { isSubscriptionActive } from "../../subscription/subscription.util";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "../../config/config.service";
import type { JwtPayload } from "../../common/types/jwt-payload";
import { PrismaService } from "../../prisma/prisma.service";
import { slugifyName } from "../../common/slug";
import { sanitizePlanPages } from "../../common/panel-access";
import { sanitizeAccess } from "../../common/staff-access";
import { TokenVersionCache } from "../token-version-cache";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokenCache: TokenVersionCache,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.sub || !payload.businessId) {
      throw new UnauthorizedException();
    }
    if (payload.tokenVersion === undefined) {
      throw new UnauthorizedException();
    }

    const cached = this.tokenCache.get(payload.sub);
    if (cached) {
      if (
        cached.tokenVersion !== payload.tokenVersion ||
        cached.businessId !== payload.businessId ||
        cached.role !== payload.role ||
        cached.businessSlug !== payload.businessSlug
      ) {
        throw new UnauthorizedException();
      }
      // Subscription expiry is re-evaluated against the clock on every hit,
      // so a plan window ending between requests is enforced immediately.
      if (
        payload.role !== "SUPERADMIN" &&
        !isSubscriptionActive({
          billingCycle: cached.billingCycle,
          subscriptionStatus: cached.subscriptionStatus,
          subscriptionEndsAt: cached.subscriptionEndsAt,
        })
      ) {
        throw new ForbiddenException(
          "This business subscription has expired. Contact the platform administrator.",
        );
      }
      return {
        ...payload,
        tokenVersion: cached.tokenVersion,
        access: cached.access,
        planPages: cached.planPages,
      };
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        businessId: payload.businessId,
        role: payload.role,
        active: true,
        tokenVersion: payload.tokenVersion,
      },
      select: {
        id: true,
        access: true,
        tokenVersion: true,
        business: {
          select: {
            slug: true,
            subscriptionStatus: true,
            subscriptionEndsAt: true,
            subscriptionPlanDef: {
              select: { billingCycle: true, allowedPages: true },
            },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    if (payload.role !== "SUPERADMIN" && user.business?.slug !== payload.businessSlug) {
      throw new UnauthorizedException();
    }
    if (
      payload.role !== "SUPERADMIN" &&
      user.business &&
      !isSubscriptionActive({
        billingCycle: user.business.subscriptionPlanDef?.billingCycle,
        subscriptionStatus: user.business.subscriptionStatus,
        subscriptionEndsAt: user.business.subscriptionEndsAt,
      })
    ) {
      throw new ForbiddenException(
        "This business subscription has expired. Contact the platform administrator.",
      );
    }
    const planPages = sanitizePlanPages(
      user.business?.subscriptionPlanDef?.allowedPages,
    );
    const access = sanitizeAccess(user.access);
    this.tokenCache.set(payload.sub, {
      tokenVersion: user.tokenVersion,
      businessId: payload.businessId,
      role: payload.role,
      businessSlug: payload.businessSlug,
      access,
      planPages,
      billingCycle: user.business?.subscriptionPlanDef?.billingCycle ?? null,
      subscriptionStatus: user.business?.subscriptionStatus ?? null,
      subscriptionEndsAt: user.business?.subscriptionEndsAt ?? null,
    });
    return {
      ...payload,
      tokenVersion: user.tokenVersion,
      access,
      planPages,
    };
  }
}
