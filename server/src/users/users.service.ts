import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { assertTemplateIds } from "../catalog/product-templates";
import { TemplateProvisionService } from "../catalog/template-provision.service";
import { PrismaService } from "../prisma/prisma.service";
import { subscriptionWindow } from "../subscription/subscription.util";
import { AuthService } from "../auth/auth.service";
import { uniqueBusinessSlug } from "../common/slug";
import { sanitizeAccess } from "../common/staff-access";
import { CreateOwnerDto } from "./dto/create-owner.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateSubscriptionDto } from "./dto/update-subscription.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

const businessSelect = {
  id: true,
  name: true,
  slug: true,
  createdAt: true,
  subscriptionPlan: true,
  subscriptionStatus: true,
  subscriptionStartsAt: true,
  subscriptionEndsAt: true,
  assignedTemplateIds: true,
  templatesAppliedAt: true,
} as const;

const ownerSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  loginPassword: true,
  createdAt: true,
  business: { select: businessSelect },
} as const;

const staffSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  title: true,
  access: true,
  active: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly templateProvision: TemplateProvisionService,
  ) {}

  listOwners() {
    return this.prisma.user.findMany({
      where: { role: "ADMIN" },
      select: ownerSelect,
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    });
  }

  async createOwner(dto: CreateOwnerDto) {
    await this.authService.assertEmailAvailable(dto.email);
    const passwordHash = await this.authService.hashPassword(dto.password);
    const businessName = dto.businessName.trim();
    const slug = await uniqueBusinessSlug(this.prisma, businessName);
    const plan = dto.subscriptionPlan ?? SubscriptionPlan.MONTHLY;
    const { startsAt, endsAt } = subscriptionWindow(plan);
    const templateIds = assertTemplateIds(dto.templateIds ?? []);

    const user = await this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: businessName,
          slug,
          subscriptionPlan: plan,
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          subscriptionStartsAt: startsAt,
          subscriptionEndsAt: endsAt,
          assignedTemplateIds: templateIds,
        },
      });
      return tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          loginPassword: dto.password,
          name: dto.name.trim(),
          role: "ADMIN",
          businessId: business.id,
        },
        select: ownerSelect,
      });
    });

    if (templateIds.length) {
      await this.templateProvision.applyTemplates(user.business.id, templateIds);
      await this.prisma.business.update({
        where: { id: user.business.id },
        data: { templatesAppliedAt: new Date() },
      });
    }

    return this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: ownerSelect,
    });
  }

  async updateOwner(id: string, dto: { password?: string; active?: boolean }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Owner not found");
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Only business-owner logins can be updated");
    }
    const data: { passwordHash?: string; loginPassword?: string; active?: boolean } = {};
    if (dto.password) {
      data.passwordHash = await this.authService.hashPassword(dto.password);
      data.loginPassword = dto.password;
    }
    if (dto.active !== undefined) data.active = dto.active;
    if (!Object.keys(data).length) {
      return this.prisma.user.findUniqueOrThrow({ where: { id }, select: ownerSelect });
    }
    return this.prisma.user.update({
      where: { id },
      data,
      select: ownerSelect,
    });
  }

  async applyOwnerTemplates(ownerId: string, templateIds: string[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        role: true,
        businessId: true,
        business: { select: { assignedTemplateIds: true } },
      },
    });
    if (!user) throw new NotFoundException("Owner not found");
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Only business-owner templates can be updated");
    }

    const ids = assertTemplateIds(templateIds);
    if (!ids.length) {
      throw new BadRequestException("Select at least one valid product template");
    }

    await this.templateProvision.applyTemplates(user.businessId, ids);

    const merged = [...new Set([...(user.business.assignedTemplateIds ?? []), ...ids])];
    await this.prisma.business.update({
      where: { id: user.businessId },
      data: {
        assignedTemplateIds: merged,
        templatesAppliedAt: new Date(),
      },
    });

    return this.prisma.user.findUniqueOrThrow({
      where: { id: ownerId },
      select: ownerSelect,
    });
  }

  async updateOwnerSubscription(ownerId: string, dto: UpdateSubscriptionDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, role: true, businessId: true },
    });
    if (!user) throw new NotFoundException("Owner not found");
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Only business-owner subscriptions can be updated");
    }

    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: user.businessId },
    });

    const plan = dto.plan ?? business.subscriptionPlan ?? SubscriptionPlan.MONTHLY;
    let status = dto.status ?? business.subscriptionStatus;
    let startsAt = business.subscriptionStartsAt ?? new Date();
    let endsAt = business.subscriptionEndsAt;

    if (dto.plan && dto.plan !== business.subscriptionPlan) {
      const window = subscriptionWindow(plan);
      startsAt = window.startsAt;
      endsAt = window.endsAt;
      status = SubscriptionStatus.ACTIVE;
    }

    if (dto.endsAt && plan !== SubscriptionPlan.LIFETIME) {
      const parsed = new Date(dto.endsAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException("endsAt must be a valid date");
      }
      endsAt = parsed;
      if (status === SubscriptionStatus.ACTIVE && endsAt < new Date()) {
        status = SubscriptionStatus.EXPIRED;
      }
    }

    if (plan === SubscriptionPlan.LIFETIME) {
      endsAt = null;
      if (status !== SubscriptionStatus.CANCELLED) {
        status = SubscriptionStatus.ACTIVE;
      }
    }

    await this.prisma.business.update({
      where: { id: user.businessId },
      data: {
        subscriptionPlan: plan,
        subscriptionStatus: status,
        subscriptionStartsAt: startsAt,
        subscriptionEndsAt: endsAt,
      },
    });

    return this.prisma.user.findUniqueOrThrow({
      where: { id: ownerId },
      select: ownerSelect,
    });
  }

  async removeOwner(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Owner not found");
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Only business-owner logins can be revoked");
    }
    await this.prisma.user.update({
      where: { id },
      data: { active: false },
    });
  }

  listStaff(businessId: string) {
    return this.prisma.user.findMany({
      where: { businessId, role: "SUBADMIN", active: true },
      select: staffSelect,
      orderBy: { createdAt: "asc" },
    });
  }

  async createStaff(businessId: string, dto: CreateUserDto) {
    await this.authService.assertEmailAvailable(dto.email);
    const passwordHash = await this.authService.hashPassword(dto.password);
    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name.trim(),
        title: dto.title.trim(),
        role: "SUBADMIN",
        access: sanitizeAccess(dto.access),
        businessId,
      },
      select: staffSelect,
    });
  }

  async updateStaff(businessId: string, id: string, dto: UpdateUserDto) {
    const user = await this.assertStaff(businessId, id);
    const data: {
      name?: string;
      title?: string;
      access?: string[];
      passwordHash?: string;
    } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.access !== undefined) data.access = sanitizeAccess(dto.access);
    if (dto.password) data.passwordHash = await this.authService.hashPassword(dto.password);
    return this.prisma.user.update({
      where: { id: user.id },
      data,
      select: staffSelect,
    });
  }

  async removeStaff(businessId: string, id: string) {
    await this.assertStaff(businessId, id);
    await this.prisma.user.update({
      where: { id },
      data: { active: false },
    });
  }

  private async assertStaff(businessId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, businessId, role: "SUBADMIN", active: true },
    });
    if (!user) throw new NotFoundException("Staff member not found");
    return user;
  }
}
