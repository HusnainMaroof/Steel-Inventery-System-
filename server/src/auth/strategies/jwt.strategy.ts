import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "../../config/config.service";
import type { JwtPayload } from "../../common/types/jwt-payload";
import { PrismaService } from "../../prisma/prisma.service";
import { slugifyName } from "../../common/slug";

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
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        businessId: payload.businessId,
        role: payload.role,
        active: true,
      },
      select: { id: true, business: { select: { slug: true } } },
    });
    if (!user) throw new UnauthorizedException();
    if (payload.role !== "SUPERADMIN" && user.business?.slug !== payload.businessSlug) {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
