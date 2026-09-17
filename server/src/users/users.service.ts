import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SubscriptionStatus } from "@prisma/client";
import { TemplateProvisionService } from "../catalog/template-provision.service";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionPlansService } from "../subscription/subscription-plans.service";
import { isSubscriptionActive, subscriptionWindowForPlan } from "../subscription/subscription.util";
import { AuthService } from "../auth/auth.service";
import { AuditService } from "../common/audit/audit.service";
import { purgeBusiness } from "../common/purge-business";
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
  subscriptionPlanId: true,
  subscriptionPlanDef: {
    select: {
      id: true,
      label: true,
      billingCycle: true,
      durationDays: true,
      allowedPages: true,
    },
  },
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
    private readonly subscriptionPlans: SubscriptionPlansService,
    private readonly audit: AuditService,
  ) {}

  async listOwners(skip: number, take: number) {
    const where = { role: "ADMIN" as const };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: ownerSelect,
        orderBy: [{ active: "desc" }, { createdAt: "asc" }],
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return [items, total] as const;
  }

  async getOwner(id: string) {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const owner = await this.prisma.user.findFirst({
      where: { id, role: "ADMIN" },
      select: ownerSelect,
    });
    if (!owner) throw new NotFoundException("Owner not found");

    const businessId = owner.business.id;
    const [sales30d, purchases30d, payments30d] = await Promise.all([
      this.prisma.sale.count({ where: { businessId, date: { gte: since } } }),
      this.prisma.purchase.count({ where: { businessId, date: { gte: since } } }),
      this.prisma.payment.count({ where: { businessId, date: { gte: since } } }),
    ]);

    const plan = owner.business.subscriptionPlanDef;
    return {
      ...owner,
      subscriptionActive: isSubscriptionActive({
        billingCycle: plan?.billingCycle,
        subscriptionStatus: owner.business.subscriptionStatus,
        subscriptionEndsAt: owner.business.subscriptionEndsAt,
      }),
      activity30d: {
        sales: sales30d,
        purchases: purchases30d,
        payments: payments30d,
      },
    };
  }

  async createOwner(dto: CreateOwnerDto, actorId?: string) {
    await this.authService.assertEmailAvailable(dto.email);
    const passwordHash = await this.authService.hashPassword(dto.password);
    const businessName = dto.businessName.trim();
    const slug = await uniqueBusinessSlug(this.prisma, businessName);
    const plan = dto.subscriptionPlanId
      ? await this.subscriptionPlans.getById(dto.subscriptionPlanId)
      : await this.subscriptionPlans.getDefaultPlan();
    const { startsAt, endsAt } = subscriptionWindowForPlan(plan);
    const templateIds = await this.templateProvision.filterValidTemplateIds(
      dto.templateIds ?? [],
    );

    const user = await this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: businessName,
          slug,
          subscriptionPlanId: plan.id,
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          subscriptionStartsAt: startsAt,
          subscriptionEndsAt: endsAt,
          assignedTemplateIds: templateIds,
          settings: dto.logoUrl ? { logoUrl: dto.logoUrl } : undefined,
        },
      });
      return tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
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

    const created = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: ownerSelect,
    });
    await this.audit.log({
      businessId: created.business.id,
      actorId: actorId ?? null,
      action: "owner.created",
      entityType: "user",
      entityId: created.id,
    });
    return created;
  }

  async updateOwner(
    id: string,
    dto: { password?: string; active?: boolean },
    actorId?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Owner not found");
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Only business-owner logins can be updated");
    }
    const data: { passwordHash?: string; active?: boolean } = {};
    if (dto.password) {
      data.passwordHash = await this.authService.hashPassword(dto.password);
    }
    if (dto.active !== undefined) data.active = dto.active;
    if (!Object.keys(data).length) {
      return this.prisma.user.findUniqueOrThrow({ where: { id }, select: ownerSelect });
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: ownerSelect,
    });
    if (dto.password || dto.active === false) {
      await this.authService.invalidateSessions(id);
    }
    if (dto.active === false) {
      await this.audit.log({
        businessId: updated.business.id,
        actorId: actorId ?? null,
        action: "owner.deactivated",
        entityType: "user",
        entityId: id,
      });
    } else if (dto.password) {
      await this.audit.log({
        businessId: updated.business.id,
        actorId: actorId ?? null,
        action: "owner.password_reset",
        entityType: "user",
        entityId: id,
      });
    }
    return updated;
  }

  async applyOwnerTemplates(
    ownerId: string,
    templateIds: string[],
    actorId?: string,
  ) {
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

    const ids = await this.templateProvision.filterValidTemplateIds(templateIds);
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

    const updated = await this.prisma.user.findUniqueOrThrow({
      where: { id: ownerId },
      select: ownerSelect,
    });
    await this.audit.log({
      businessId: user.businessId,
      actorId: actorId ?? null,
      action: "owner.templates_applied",
      entityType: "business",
      entityId: user.businessId,
      metadata: { templateIds: ids },
    });
    return updated;
  }

  async updateOwnerSubscription(
    ownerId: string,
    dto: UpdateSubscriptionDto,
    actorId?: string,
  ) {
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

    const currentPlan = business.subscriptionPlanId
      ? await this.subscriptionPlans.getById(business.subscriptionPlanId)
      : await this.subscriptionPlans.getDefaultPlan();
    const plan = dto.planId
      ? await this.subscriptionPlans.getById(dto.planId)
      : currentPlan;
    let status = dto.status ?? business.subscriptionStatus;
    let startsAt = business.subscriptionStartsAt ?? new Date();
    let endsAt = business.subscriptionEndsAt;

    if (dto.planId && dto.planId !== business.subscriptionPlanId) {
      const window = subscriptionWindowForPlan(plan);
      startsAt = window.startsAt;
      endsAt = window.endsAt;
      status = SubscriptionStatus.ACTIVE;
    }

    if (dto.endsAt && plan.billingCycle !== "LIFETIME") {
      const parsed = new Date(dto.endsAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException("endsAt must be a valid date");
      }
      endsAt = parsed;
      if (status === SubscriptionStatus.ACTIVE && endsAt < new Date()) {
        status = SubscriptionStatus.EXPIRED;
      }
    }

    if (plan.billingCycle === "LIFETIME") {
      endsAt = null;
      if (status !== SubscriptionStatus.CANCELLED) {
        status = SubscriptionStatus.ACTIVE;
      }
    }

    await this.prisma.business.update({
      where: { id: user.businessId },
      data: {
        subscriptionPlanId: plan.id,
        subscriptionStatus: status,
        subscriptionStartsAt: startsAt,
        subscriptionEndsAt: endsAt,
      },
    });

    const updated = await this.prisma.user.findUniqueOrThrow({
      where: { id: ownerId },
      select: ownerSelect,
    });
    await this.audit.log({
      businessId: user.businessId,
      actorId: actorId ?? null,
      action: "owner.subscription_updated",
      entityType: "business",
      entityId: user.businessId,
      metadata: { planId: plan.id, status },
    });
    return updated;
  }

  async deleteOwner(id: string, actorId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Owner not found");
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Only business-owner accounts can be deleted");
    }

    await this.audit.log({
      businessId: user.businessId,
      actorId: actorId ?? null,
      action: "owner.deleted",
      entityType: "business",
      entityId: user.businessId,
    });
    await this.prisma.$transaction(async (tx) => {
      await purgeBusiness(tx, user.businessId);
    });
  }

  async listStaff(businessId: string, skip: number, take: number) {
    const where = { businessId, role: "SUBADMIN" as const, active: true };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: staffSelect,
        orderBy: { createdAt: "asc" },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return [items, total] as const;
  }

  async createStaff(businessId: string, dto: CreateUserDto, actorId?: string) {
    await this.authService.assertEmailAvailable(dto.email);
    const passwordHash = await this.authService.hashPassword(dto.password);
    const staff = await this.prisma.user.create({
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
    await this.audit.log({
      businessId,
      actorId: actorId ?? null,
      action: "staff.created",
      entityType: "user",
      entityId: staff.id,
      metadata: { access: staff.access },
    });
    return staff;
  }

  async updateStaff(
    businessId: string,
    id: string,
    dto: UpdateUserDto,
    actorId?: string,
  ) {
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
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data,
      select: staffSelect,
    });
    if (dto.password || dto.access !== undefined) {
      await this.authService.invalidateSessions(user.id);
    }
    await this.audit.log({
      businessId,
      actorId: actorId ?? null,
      action: dto.access !== undefined ? "staff.permissions_updated" : "staff.updated",
      entityType: "user",
      entityId: user.id,
      metadata: dto.access !== undefined ? { access: updated.access } : undefined,
    });
    return updated;
  }

  async removeStaff(businessId: string, id: string, actorId?: string) {
    const user = await this.assertStaff(businessId, id);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { active: false },
    });
    await this.authService.invalidateSessions(user.id);
    await this.audit.log({
      businessId,
      actorId: actorId ?? null,
      action: "staff.deactivated",
      entityType: "user",
      entityId: user.id,
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
