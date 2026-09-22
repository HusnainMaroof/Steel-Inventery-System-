import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { AuditService } from "../common/audit/audit.service";
import type { StaffPage } from "../common/staff-access";
import { LIMITS } from "../common/security/limits";
import { sanitizeUiSettings } from "../common/security/sanitize-settings";
import { PrismaService } from "../prisma/prisma.service";
import { filterBootstrapForStaff } from "./bootstrap-access";
import { CatalogueCache, type BootstrapCatalogue } from "./catalogue-cache";

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
    private readonly audit: AuditService,
    private readonly catalogueCache: CatalogueCache,
  ) {}

  /**
   * Slim bootstrap — catalogue configuration, settings, staff, counts.
   * Catalogue + settings come from an in-process cache that every
   * catalogue/settings write invalidates synchronously. Counts and staff
   * are always live. Transaction collections load via /ledger/transactions.
   */
  async bootstrap(businessId: string, role?: Role, staffAccess?: StaffPage[]) {
    const [catalogue, countRows, staff] = await Promise.all([
      this.loadCatalogue(businessId),
      this.loadCounts(businessId),
      role === "ADMIN"
        ? this.prisma.user.findMany({
            where: { businessId, role: "SUBADMIN", active: true },
            select: staffSelect,
            orderBy: { createdAt: "asc" },
            take: LIMITS.MAX_PAGE_SIZE,
          })
        : Promise.resolve([]),
    ]);

    const payload = {
      version: 3,
      counts: {
        customers: Number(countRows.customers ?? 0),
        suppliers: Number(countRows.suppliers ?? 0),
        purchases: Number(countRows.purchases ?? 0),
        sales: Number(countRows.sales ?? 0),
        payments: Number(countRows.payments ?? 0),
        expenses: Number(countRows.expenses ?? 0),
        stockChecks: Number(countRows.stockChecks ?? 0),
      },
      suppliers: [] as unknown[],
      customers: [] as unknown[],
      purchases: [] as unknown[],
      sales: [] as unknown[],
      payments: [] as unknown[],
      expenses: [] as unknown[],
      stockChecks: [] as unknown[],
      products: catalogue.products,
      productItems: catalogue.productItems,
      categories: catalogue.categories,
      attributeDefs: catalogue.attributeDefs.map(({ options: _options, ...def }) => def),
      attributeOptions: catalogue.attributeDefs.flatMap((def) => def.options),
      variants: catalogue.variants,
      warehouses: catalogue.warehouses.map(({ locations: _locations, ...warehouse }) => warehouse),
      locations: catalogue.warehouses.flatMap((warehouse) => warehouse.locations),
      staff,
      settings: catalogue.settings,
    };

    if (role === "SUBADMIN") {
      return filterBootstrapForStaff(payload as never, staffAccess);
    }
    return payload;
  }

  private async loadCatalogue(businessId: string): Promise<BootstrapCatalogue> {
    const cached = this.catalogueCache.get(businessId);
    if (cached) return cached;

    const [products, productItems, categories, attributeDefs, variants, warehouses, business] =
      await this.prisma.$transaction([
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
        this.prisma.business.findUniqueOrThrow({
          where: { id: businessId },
          select: { settings: true },
        }),
      ]);

    const data: BootstrapCatalogue = {
      products,
      productItems,
      categories,
      attributeDefs: attributeDefs as BootstrapCatalogue["attributeDefs"],
      variants,
      warehouses: warehouses as BootstrapCatalogue["warehouses"],
      settings: (business.settings ?? {}) as Record<string, unknown>,
    };
    this.catalogueCache.set(businessId, data);
    return data;
  }

  private async loadCounts(businessId: string) {
    const [row] = await this.prisma.$queryRaw<
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
    `;
    return (
      row ?? {
        customers: 0 as const,
        suppliers: 0 as const,
        purchases: 0 as const,
        sales: 0 as const,
        payments: 0 as const,
        expenses: 0 as const,
        stockChecks: 0 as const,
      }
    );
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
    this.catalogueCache.invalidate(businessId);
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
