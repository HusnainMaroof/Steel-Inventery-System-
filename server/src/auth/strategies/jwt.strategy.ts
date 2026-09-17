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

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
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
    return {
      ...payload,
      tokenVersion: user.tokenVersion,
      access: sanitizeAccess(user.access),
      planPages,
    };
  }
}
