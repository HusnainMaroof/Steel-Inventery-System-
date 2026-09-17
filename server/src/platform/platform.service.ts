import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TemplateProvisionService } from "../catalog/template-provision.service";
import { SubscriptionPlansService } from "../subscription/subscription-plans.service";
import { isSubscriptionActive } from "../subscription/subscription.util";
import { CreateSubscriptionPlanDto } from "../subscription/dto/create-subscription-plan.dto";
import { UpdateSubscriptionPlanDto } from "../subscription/dto/update-subscription-plan.dto";
import { CreateCatalogTemplateDto } from "./dto/create-catalog-template.dto";

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplateProvisionService,
    private readonly subscriptionPlans: SubscriptionPlansService,
  ) {}

  listProductTemplates() {
    return this.templates.listTemplates();
  }

  listProductTemplatesFull() {
    return this.templates.listTemplatesFull();
  }

  createCatalogTemplate(dto: CreateCatalogTemplateDto) {
    return this.templates.createCatalogTemplate(dto);
  }

  listSubscriptionPlans(includeInactive = false) {
    return this.subscriptionPlans.list(includeInactive);
  }

  createSubscriptionPlan(dto: CreateSubscriptionPlanDto) {
    return this.subscriptionPlans.create(dto);
  }

  updateSubscriptionPlan(id: string, dto: UpdateSubscriptionPlanDto) {
    return this.subscriptionPlans.update(id, dto);
  }

  async overview() {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [
      owners,
      businesses,
      sales30d,
      purchases30d,
      payments30d,
      recentSales,
      recentPurchases,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: "ADMIN" },
        select: {
          id: true,
          active: true,
          business: {
            select: {
              id: true,
              name: true,
              slug: true,
              subscriptionPlanId: true,
              subscriptionPlanDef: {
                select: { id: true, label: true, billingCycle: true },
              },
              subscriptionStatus: true,
              subscriptionStartsAt: true,
              subscriptionEndsAt: true,
              assignedTemplateIds: true,
            },
          },
        },
      }),
      this.prisma.business.count({
        where: { users: { some: { role: "ADMIN" } } },
      }),
      this.prisma.sale.count({ where: { date: { gte: since } } }),
      this.prisma.purchase.count({ where: { date: { gte: since } } }),
      this.prisma.payment.count({ where: { date: { gte: since } } }),
      this.prisma.sale.findMany({
        take: 8,
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          date: true,
          createdAt: true,
          business: { select: { name: true, slug: true } },
          customer: { select: { name: true } },
          invoice: { select: { number: true } },
        },
      }),
      this.prisma.purchase.findMany({
        take: 8,
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          date: true,
          createdAt: true,
          business: { select: { name: true, slug: true } },
          supplier: { select: { name: true } },
        },
      }),
    ]);

    const activeOwners = owners.filter((o) => o.active).length;
    const revokedOwners = owners.length - activeOwners;

    const planCatalog = await this.subscriptionPlans.list(true);
    const planCounts = new Map(planCatalog.map((plan) => [plan.id, 0]));
    let activeSubscriptions = 0;
    let expiredSubscriptions = 0;

    for (const owner of owners) {
      const b = owner.business;
      if (!b?.subscriptionPlanId) continue;
      planCounts.set(b.subscriptionPlanId, (planCounts.get(b.subscriptionPlanId) ?? 0) + 1);
      if (
        isSubscriptionActive({
          billingCycle: b.subscriptionPlanDef?.billingCycle,
          subscriptionStatus: b.subscriptionStatus,
          subscriptionEndsAt: b.subscriptionEndsAt,
        })
      ) {
        activeSubscriptions++;
      } else {
        expiredSubscriptions++;
      }
    }

    const subscriptionCounts = {
      active: activeSubscriptions,
      expired: expiredSubscriptions,
      byPlan: planCatalog.map((plan) => ({
        id: plan.id,
        label: plan.label,
        billingCycle: plan.billingCycle,
        count: planCounts.get(plan.id) ?? 0,
      })),
    };

    const perBusiness = await Promise.all(
      owners.map(async (owner) => {
        const businessId = owner.business?.id;
        if (!businessId) {
          return {
            ownerId: owner.id,
            businessId: "",
            sales30d: 0,
            purchases30d: 0,
            payments30d: 0,
          };
        }
        const [s, p, pay] = await Promise.all([
          this.prisma.sale.count({ where: { businessId, date: { gte: since } } }),
          this.prisma.purchase.count({ where: { businessId, date: { gte: since } } }),
          this.prisma.payment.count({ where: { businessId, date: { gte: since } } }),
        ]);
        return {
          ownerId: owner.id,
          businessId,
          sales30d: s,
          purchases30d: p,
          payments30d: pay,
        };
      }),
    );

    const activityByOwner = new Map(perBusiness.map((row) => [row.ownerId, row]));

    return {
      totals: {
        businesses,
        owners: owners.length,
        activeOwners,
        revokedOwners,
        sales30d,
        purchases30d,
        payments30d,
      },
      subscriptions: subscriptionCounts,
      recentActivity: [
        ...recentSales.map((s) => ({
          type: "sale" as const,
          at: s.createdAt.toISOString(),
          businessName: s.business.name,
          businessSlug: s.business.slug,
          label: s.invoice?.number ?? "Sale",
          party: s.customer.name,
        })),
        ...recentPurchases.map((p) => ({
          type: "purchase" as const,
          at: p.createdAt.toISOString(),
          businessName: p.business.name,
          businessSlug: p.business.slug,
          label: "Purchase",
          party: p.supplier.name,
        })),
      ]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 12),
      businesses: owners.map((owner) => {
        const b = owner.business;
        const activity = activityByOwner.get(owner.id);
        const subActive =
          b &&
          isSubscriptionActive({
            billingCycle: b.subscriptionPlanDef?.billingCycle,
            subscriptionStatus: b.subscriptionStatus,
            subscriptionEndsAt: b.subscriptionEndsAt,
          });
        return {
          ownerId: owner.id,
          ownerActive: owner.active,
          businessId: b?.id ?? "",
          businessName: b?.name ?? "",
          businessSlug: b?.slug ?? "",
          subscriptionPlanId: b?.subscriptionPlanId ?? null,
          subscriptionPlanLabel: b?.subscriptionPlanDef?.label ?? "—",
          subscriptionPlan: b?.subscriptionPlanDef
            ? {
                id: b.subscriptionPlanDef.id,
                label: b.subscriptionPlanDef.label,
                billingCycle: b.subscriptionPlanDef.billingCycle,
              }
            : null,
          subscriptionStatus: b?.subscriptionStatus ?? null,
          subscriptionActive: subActive ?? true,
          subscriptionStartsAt: b?.subscriptionStartsAt?.toISOString() ?? null,
          subscriptionEndsAt: b?.subscriptionEndsAt?.toISOString() ?? null,
          assignedTemplateIds: b?.assignedTemplateIds ?? [],
          activity30d: {
            sales: activity?.sales30d ?? 0,
            purchases: activity?.purchases30d ?? 0,
            payments: activity?.payments30d ?? 0,
          },
        };
      }),
    };
  }
}
