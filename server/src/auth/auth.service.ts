import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "../config/config.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import type { JwtPayload, UserRole } from "../common/types/jwt-payload";
import { AuditService } from "../common/audit/audit.service";
import { sanitizePlanPages } from "../common/panel-access";
import { slugifyName } from "../common/slug";
import { TokenVersionService } from "./token-version.service";

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tokenVersions: TokenVersionService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensurePlatformAdmin();
  }

  /**
   * Creates the single Super Admin from ADMIN_EMAIL / ADMIN_PASSWORD
   * if one does not already exist. Business owners never self-register.
   */
  async ensurePlatformAdmin(): Promise<void> {
    const email = this.config.adminEmail;
    const password = this.config.adminPassword;
    if (!email || !password) {
      this.logger.warn(
        "ADMIN_EMAIL / ADMIN_PASSWORD are not set — Super Admin was not created.",
      );
      return;
    }
    if (password.length < 8) {
      throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
    }

    const existingAdmin = await this.prisma.user.findFirst({
      where: { role: "SUPERADMIN" },
    });
    if (existingAdmin) {
      const patch: { name?: string; active?: boolean } = {};
      if (existingAdmin.name === "Platform Admin") patch.name = "Super Admin";
      if (!existingAdmin.active) patch.active = true;
      if (Object.keys(patch).length > 0) {
        await this.prisma.user.update({
          where: { id: existingAdmin.id },
          data: patch,
        });
      }
      this.logger.log(`super admin ready email=${existingAdmin.email}`);
      return;
    }

    const taken = await this.prisma.user.findUnique({ where: { email } });
    if (taken) {
      this.logger.warn(
        `ADMIN_EMAIL ${email} is already a ${taken.role} account — not promoted.`,
      );
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const slug = slugifyName("Tradex");
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: "Super Admin",
        role: "SUPERADMIN",
        business: { create: { name: "Tradex", slug } },
      },
    });
    this.logger.log(`super admin created email=${user.email}`);
  }

  async status(): Promise<{ registrationOpen: boolean }> {
    return { registrationOpen: false };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        business: {
          select: {
            name: true,
            slug: true,
            subscriptionPlanDef: { select: { allowedPages: true } },
          },
        },
      },
    });
    if (
      !user ||
      !user.active ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      if (user?.active) {
        await this.audit.log({
          actorId: user.id,
          businessId: user.businessId,
          action: "auth.login_failed",
          entityType: "user",
          entityId: user.id,
        });
      }
      throw new UnauthorizedException("Invalid email or password");
    }
    await this.audit.log({
      actorId: user.id,
      businessId: user.businessId,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
    });
    return this.issueToken(user);
  }

  async logout(userId: string, businessId: string) {
    await this.tokenVersions.bump(userId);
    await this.audit.log({
      actorId: userId,
      businessId,
      action: "auth.logout",
      entityType: "user",
      entityId: userId,
    });
    return { ok: true };
  }

  /** Public self-signup is closed. Owners are created by Super Admin. */
  register(_dto: RegisterDto) {
    throw new ForbiddenException(
      "Registration is closed. Ask an admin to create your account.",
    );
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        title: true,
        access: true,
        businessId: true,
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            subscriptionPlanDef: { select: { allowedPages: true } },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    return {
      ...user,
      planPages: sanitizePlanPages(user.business?.subscriptionPlanDef?.allowedPages),
    };
  }

  async invalidateSessions(userId: string): Promise<void> {
    await this.tokenVersions.bump(userId);
  }

  private async issueToken(user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    businessId: string;
    tokenVersion: number;
    title?: string | null;
    access?: string[];
    business?: {
      name: string;
      slug: string;
      subscriptionPlanDef?: { allowedPages: string[] } | null;
    } | null;
  }) {
    const business =
      user.business ??
      (await this.prisma.business.findUnique({
        where: { id: user.businessId },
        select: {
          name: true,
          slug: true,
          subscriptionPlanDef: { select: { allowedPages: true } },
        },
      }));
    const businessSlug = business?.slug ?? slugifyName(business?.name ?? "business");
    const planPages = sanitizePlanPages(business?.subscriptionPlanDef?.allowedPages);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      businessId: user.businessId,
      businessSlug,
      tokenVersion: user.tokenVersion,
      planPages,
    };
    const businessName = business?.name ?? "";
    return {
      access_token: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        title: user.title ?? null,
        access: user.access ?? [],
        planPages,
        businessId: user.businessId,
        businessName,
        businessSlug,
      },
    };
  }

  async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) throw new BadRequestException("Email is already registered");
  }

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}
