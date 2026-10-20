import {
  BadRequestException,
  ConflictException,
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
import { TokenVersionService } from "../auth/token-version.service";
import { AuditService } from "../common/audit/audit.service";
import { purgeBusiness } from "../common/purge-business";
import { uniqueBusinessSlug } from "../common/slug";
import { newRecordId } from "../common/record-id";
import { buildTemplateRows, catalogueInsertCtes } from "../catalog/template-rows";
import { sanitizeAccess } from "../common/staff-access";
import { sanitizeText } from "../common/security/sanitize-text";
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
    private readonly tokenVersions: TokenVersionService,
    private readonly templateProvision: TemplateProvisionService,
    private readonly subscriptionPlans: SubscriptionPlansService,
    private readonly audit: AuditService,
  ) {}

  async listOwners(skip: number, take: number) {
    const where = { role: "ADMIN" as const };
    const [items, total] = await Promise.all([
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

  /**
   * Latency: the checks run in parallel (one round trip), then the business, the
   * owner login, the template catalogue and the audit row are written by one
   * statement, and one read returns the owner. Three round trips in total, however
   * many templates are applied. Foreign keys between the new rows are checked at
   * the end of the statement, and a failure rolls the whole statement back.
   */
  async createOwner(dto: CreateOwnerDto, actorId?: string) {
    const email = dto.email.toLowerCase();
    const businessName = dto.businessName.trim();
    const [, passwordHash, slug, plan, templates] = await Promise.all([
      this.authService.assertEmailAvailable(email),
      this.authService.hashPassword(dto.password),
      uniqueBusinessSlug(this.prisma, businessName),
      dto.subscriptionPlanId
        ? this.subscriptionPlans.getById(dto.subscriptionPlanId)
        : this.subscriptionPlans.getDefaultPlan(),
      this.templateProvision.loadTemplates(dto.templateIds ?? []),
    ]);
    const { startsAt, endsAt } = subscriptionWindowForPlan(plan);
    const templateIds = templates.map((template) => template.id);
    const { rows } = buildTemplateRows(templates);
    const businessId = newRecordId();
    const userId = newRecordId();
    const utc = (value: Date | null | undefined) => (value ? value.toISOString() : null);

    try {
      await this.prisma.$executeRaw`
        WITH new_business AS (
          INSERT INTO "Business" ("id", "name", "slug", "settings", "subscriptionPlanId", "subscriptionStatus",
                                  "subscriptionStartsAt", "subscriptionEndsAt", "assignedTemplateIds",
                                  "templatesAppliedAt")
          VALUES (${businessId}, ${businessName}, ${slug},
                  ${dto.logoUrl ? JSON.stringify({ logoUrl: dto.logoUrl }) : null}::jsonb,
                  ${plan.id}, ${SubscriptionStatus.ACTIVE}::"SubscriptionStatus",
                  (${utc(startsAt)}::timestamptz AT TIME ZONE 'UTC'),
                  (${utc(endsAt)}::timestamptz AT TIME ZONE 'UTC'),
                  ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(templateIds)}::jsonb)),
                  CASE WHEN ${templateIds.length > 0}::boolean THEN (now() AT TIME ZONE 'UTC') END)
          RETURNING "id"
        ),
        new_user AS (
          INSERT INTO "User" ("id", "email", "passwordHash", "name", "role", "businessId")
          SELECT ${userId}, ${email}, ${passwordHash}, ${dto.name.trim()}, 'ADMIN'::"Role", b."id"
          FROM new_business b
          RETURNING "id"
        ),
        ${catalogueInsertCtes(businessId, rows)},
        new_audit AS (
          INSERT INTO "AuditLog" ("id", "businessId", "actorId", "action", "entityType", "entityId")
          VALUES (${newRecordId()}, ${businessId}, ${actorId ?? null}, 'owner.created', 'user', ${userId})
          RETURNING 1
        )
        SELECT 1
      `;
    } catch (error) {
      const text = String((error as Error)?.message ?? error);
      if (text.includes("User_email_key")) {
        throw new BadRequestException("Email is already registered");
      }
      if (text.includes("Business_slug_key")) {
        throw new ConflictException("Another business was just created with this name. Please try again.");
      }
      throw error;
    }

    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: ownerSelect,
    });
  }

  async updateOwner(
    id: string,
    dto: { password?: string; active?: boolean; name?: string; email?: string; businessName?: string },
    actorId?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Owner not found");
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Only business-owner logins can be updated");
    }

    const name = dto.name !== undefined ? sanitizeText(dto.name, 80) : undefined;
    const businessName = dto.businessName !== undefined ? sanitizeText(dto.businessName, 80) : undefined;
    const email = dto.email !== undefined ? dto.email.trim().toLowerCase() : undefined;
    // MinLength runs before trimming, so "  " would otherwise save an empty name.
    if ((name !== undefined && name.length < 2) || (businessName !== undefined && businessName.length < 2)) {
      throw new BadRequestException("Names must be at least 2 characters.");
    }

    if (email && email !== user.email) {
      await this.authService.assertEmailAvailable(email);
    }

    const userData: { passwordHash?: string; active?: boolean; name?: string; email?: string } = {};
    if (dto.password) {
      userData.passwordHash = await this.authService.hashPassword(dto.password);
    }
    if (dto.active !== undefined) userData.active = dto.active;
    if (name !== undefined) userData.name = name;
    if (email !== undefined) userData.email = email;

    const hasUserChanges = Object.keys(userData).length > 0;
    const hasBusinessChanges = businessName !== undefined;

    if (!hasUserChanges && !hasBusinessChanges) {
      return this.prisma.user.findUniqueOrThrow({ where: { id }, select: ownerSelect });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (hasBusinessChanges) {
        await tx.business.update({
          where: { id: user.businessId },
          data: { name: businessName! },
        });
      }
      return tx.user.update({
        where: { id },
        data: userData,
        select: ownerSelect,
      });
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

    const hasProfileOrBusinessChanges =
      name !== undefined || email !== undefined || hasBusinessChanges;
    if (hasProfileOrBusinessChanges) {
      this.tokenVersions.invalidateBusiness(user.businessId);
      await this.audit.log({
        businessId: user.businessId,
        actorId: actorId ?? null,
        action: "owner.updated",
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
    const [user, templates] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: ownerId },
        select: {
          id: true,
          role: true,
          businessId: true,
          business: { select: { assignedTemplateIds: true } },
        },
      }),
      this.templateProvision.loadTemplates(templateIds),
    ]);
    if (!user) throw new NotFoundException("Owner not found");
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Only business-owner templates can be updated");
    }

    const ids = templates.map((template) => template.id);
    if (!ids.length) {
      throw new BadRequestException("Select at least one valid product template");
    }

    await this.templateProvision.applyTemplates(user.businessId, templates);

    const merged = [...new Set([...(user.business.assignedTemplateIds ?? []), ...ids])];
    await this.prisma.business.update({
      where: { id: user.businessId },
      data: {
        assignedTemplateIds: merged,
        templatesAppliedAt: new Date(),
      },
    });

    const [updated] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: ownerId },
        select: ownerSelect,
      }),
      this.audit.log({
        businessId: user.businessId,
        actorId: actorId ?? null,
        action: "owner.templates_applied",
        entityType: "business",
        entityId: user.businessId,
        metadata: { templateIds: ids },
      }),
    ]);
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
    // Cached JWT entries carry subscription state — drop them so the new
    // plan/status is enforced on the next request, not after the TTL.
    this.tokenVersions.invalidateBusiness(user.businessId);

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

    await this.prisma.$transaction(async (tx) => {
      await purgeBusiness(tx, user.businessId);
      await this.audit.logTx(tx, {
        businessId: user.businessId,
        actorId: actorId ?? null,
        action: "owner.deleted",
        entityType: "business",
        entityId: user.businessId,
      });
    });
    // The purge hard-deletes logins without a tokenVersion bump — drop the
    // business's cached JWT entries so deleted tokens die with the account.
    this.tokenVersions.invalidateBusiness(user.businessId);
  }

  async listStaff(businessId: string, skip: number, take: number) {
    const where = { businessId, role: "SUBADMIN" as const, active: true };
    const [items, total] = await Promise.all([
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
