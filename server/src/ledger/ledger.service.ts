import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { AuditService } from "../common/audit/audit.service";
import type { StaffPage } from "../common/staff-access";
import { LIMITS } from "../common/security/limits";
import { sanitizeUiSettings } from "../common/security/sanitize-settings";
import { PrismaService } from "../prisma/prisma.service";
import { filterBootstrapForStaff } from "./bootstrap-access";
import { DashboardSummaryService } from "./dashboard-summary.service";

const staffSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  title: true,
  access: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardSummaryService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Slim bootstrap — catalogue configuration, settings, staff, dashboard summary.
   * Transaction collections load via paginated list endpoints.
   */
  async bootstrap(businessId: string, role?: Role, staffAccess?: StaffPage[]) {
    const [
      products,
      productItems,
      categories,
      attributeDefs,
      variants,
      warehouses,
      counts,
    ] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } }),
      this.prisma.productItem.findMany({ where: { businessId }, orderBy: { name: "asc" } }),
      this.prisma.productCategory.findMany({
        where: { businessId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      this.prisma.attributeDef.findMany({
        where: { businessId },
        include: { options: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      this.prisma.variant.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } }),
      this.prisma.warehouse.findMany({
        where: { businessId },
        include: { locations: { orderBy: { name: "asc" } } },
        orderBy: { name: "asc" },
      }),
      this.prisma.$queryRaw<
        {
          customers: bigint;
          suppliers: bigint;
          purchases: bigint;
          sales: bigint;
          payments: bigint;
          expenses: bigint;
          stockChecks: bigint;
        }[]
      >`
        SELECT
          (SELECT COUNT(*) FROM "Customer" WHERE "businessId" = ${businessId}) AS customers,
          (SELECT COUNT(*) FROM "Supplier" WHERE "businessId" = ${businessId}) AS suppliers,
          (SELECT COUNT(*) FROM "Purchase" WHERE "businessId" = ${businessId}) AS purchases,
          (SELECT COUNT(*) FROM "Sale" WHERE "businessId" = ${businessId}) AS sales,
          (SELECT COUNT(*) FROM "Payment" WHERE "businessId" = ${businessId}) AS payments,
          (SELECT COUNT(*) FROM "Expense" WHERE "businessId" = ${businessId}) AS expenses,
          (SELECT COUNT(*) FROM "StockCheck" WHERE "businessId" = ${businessId}) AS "stockChecks"
      `,
    ]);

    const dashboardSummary = await this.dashboard.summarize(businessId);

    const [staff, business] = await Promise.all([
      role === "ADMIN"
        ? this.prisma.user.findMany({
            where: { businessId, role: "SUBADMIN", active: true },
            select: staffSelect,
            orderBy: { createdAt: "asc" },
            take: LIMITS.MAX_PAGE_SIZE,
          })
        : Promise.resolve([]),
      this.prisma.business.findUniqueOrThrow({
        where: { id: businessId },
        select: { settings: true },
      }),
    ]);

    const row = counts[0];
    const payload = {
      version: 3,
      dashboardSummary,
      counts: {
        customers: Number(row?.customers ?? 0),
        suppliers: Number(row?.suppliers ?? 0),
        purchases: Number(row?.purchases ?? 0),
        sales: Number(row?.sales ?? 0),
        payments: Number(row?.payments ?? 0),
        expenses: Number(row?.expenses ?? 0),
        stockChecks: Number(row?.stockChecks ?? 0),
      },
      suppliers: [] as unknown[],
      customers: [] as unknown[],
      purchases: [] as unknown[],
      sales: [] as unknown[],
      payments: [] as unknown[],
      expenses: [] as unknown[],
      stockChecks: [] as unknown[],
      products,
      productItems,
      categories,
      attributeDefs: attributeDefs.map(({ options: _options, ...def }) => def),
      attributeOptions: attributeDefs.flatMap((def) => def.options),
      variants,
      warehouses: warehouses.map(({ locations: _locations, ...warehouse }) => warehouse),
      locations: warehouses.flatMap((warehouse) => warehouse.locations),
      staff,
      settings: business.settings ?? {},
    };

    if (role === "SUBADMIN") {
      return filterBootstrapForStaff(payload as never, staffAccess);
    }
    return payload;
  }

  async getPreferences(businessId: string) {
    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { settings: true },
    });
    return { data: business.settings ?? {} };
  }

  async savePreferences(
    businessId: string,
    data: Record<string, unknown>,
    actorId?: string,
  ) {
    const sanitized = sanitizeUiSettings(data);
    const serialized = JSON.stringify(sanitized);
    if (serialized.length > LIMITS.MAX_SETTINGS_BYTES) {
      throw new BadRequestException("Settings payload is too large");
    }
    const settings = sanitized as Prisma.InputJsonObject;
    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: { settings },
      select: { settings: true },
    });
    await this.audit.log({
      businessId,
      actorId: actorId ?? null,
      action: "settings.updated",
      entityType: "business",
      entityId: businessId,
    });
    return { data: business.settings ?? {} };
  }
}
