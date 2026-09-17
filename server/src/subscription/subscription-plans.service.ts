import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BillingCycle, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { sanitizePlanPages } from "../common/panel-access";
import { CreateSubscriptionPlanDto } from "./dto/create-subscription-plan.dto";
import { UpdateSubscriptionPlanDto } from "./dto/update-subscription-plan.dto";

export const DEFAULT_SUBSCRIPTION_PLAN_ID = "sub_monthly";

@Injectable()
export class SubscriptionPlansService {
  constructor(private readonly prisma: PrismaService) {}

  list(includeInactive = false) {
    return this.prisma.subscriptionPlanDefinition.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
  }

  async getById(id: string) {
    const plan = await this.prisma.subscriptionPlanDefinition.findUnique({
      where: { id },
    });
    if (!plan) throw new NotFoundException("Subscription plan not found");
    return plan;
  }

  async getDefaultPlan() {
    const plan = await this.prisma.subscriptionPlanDefinition.findFirst({
      where: { id: DEFAULT_SUBSCRIPTION_PLAN_ID, active: true },
    });
    if (plan) return plan;
    const fallback = await this.prisma.subscriptionPlanDefinition.findFirst({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    if (!fallback) throw new BadRequestException("No active subscription plans configured");
    return fallback;
  }

  async create(dto: CreateSubscriptionPlanDto) {
    this.assertBilling(dto.billingCycle, dto.durationDays);
    const allowedPages = sanitizePlanPages(dto.allowedPages);
    const id = `sub_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    return this.prisma.subscriptionPlanDefinition.create({
      data: {
        id,
        label: dto.label.trim(),
        billingCycle: dto.billingCycle,
        durationDays: dto.billingCycle === "CUSTOM_DAYS" ? dto.durationDays : null,
        description: dto.description?.trim() || null,
        price: dto.price != null ? new Prisma.Decimal(dto.price) : null,
        allowedPages,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateSubscriptionPlanDto) {
    const current = await this.getById(id);
    const billingCycle = dto.billingCycle ?? current.billingCycle;
    const durationDays =
      dto.durationDays !== undefined ? dto.durationDays : current.durationDays;
    this.assertBilling(billingCycle, durationDays);

    return this.prisma.subscriptionPlanDefinition.update({
      where: { id },
      data: {
        label: dto.label?.trim(),
        billingCycle: dto.billingCycle,
        durationDays: billingCycle === "CUSTOM_DAYS" ? durationDays : null,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
        price: dto.price !== undefined ? (dto.price != null ? new Prisma.Decimal(dto.price) : null) : undefined,
        allowedPages:
          dto.allowedPages !== undefined ? sanitizePlanPages(dto.allowedPages) : undefined,
        sortOrder: dto.sortOrder,
        active: dto.active,
      },
    });
  }

  private assertBilling(billingCycle: BillingCycle, durationDays?: number | null) {
    if (billingCycle === "CUSTOM_DAYS" && (!durationDays || durationDays < 1)) {
      throw new BadRequestException("Custom plans need durationDays of at least 1");
    }
  }
}
