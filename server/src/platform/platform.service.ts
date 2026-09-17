import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TemplateProvisionService } from "../catalog/template-provision.service";
import { isSubscriptionActive, planLabel } from "../subscription/subscription.util";

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplateProvisionService,
  ) {}

  listProductTemplates() {
    return this.templates.listTemplates();
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
              subscriptionPlan: true,
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

    const subscriptionCounts = {
      monthly: 0,
      yearly: 0,
      lifetime: 0,
      expired: 0,
      active: 0,
    };

    for (const owner of owners) {
      const b = owner.business;
      if (!b?.subscriptionPlan) continue;
      if (b.subscriptionPlan === "MONTHLY") subscriptionCounts.monthly++;
      if (b.subscriptionPlan === "YEARLY") subscriptionCounts.yearly++;
      if (b.subscriptionPlan === "LIFETIME") subscriptionCounts.lifetime++;
      if (
        isSubscriptionActive({
          subscriptionPlan: b.subscriptionPlan,
          subscriptionStatus: b.subscriptionStatus,
          subscriptionEndsAt: b.subscriptionEndsAt,
        })
      ) {
        subscriptionCounts.active++;
      } else {
        subscriptionCounts.expired++;
      }
    }

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
            subscriptionPlan: b.subscriptionPlan,
            subscriptionStatus: b.subscriptionStatus,
            subscriptionEndsAt: b.subscriptionEndsAt,
          });
        return {
          ownerId: owner.id,
          ownerActive: owner.active,
          businessId: b?.id ?? "",
          businessName: b?.name ?? "",
          businessSlug: b?.slug ?? "",
          subscriptionPlan: b?.subscriptionPlan ?? null,
          subscriptionPlanLabel: planLabel(b?.subscriptionPlan ?? null),
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
