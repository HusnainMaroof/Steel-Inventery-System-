import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrap(businessId: string) {
    const [
      suppliers,
      customers,
      purchases,
      sales,
      payments,
      expenses,
      stockChecks,
      products,
      productItems,
      categories,
      attributeDefs,
      variants,
      warehouses,
    ] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } }),
      this.prisma.customer.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } }),
      this.prisma.purchase.findMany({
        where: { businessId },
        include: { lines: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      this.prisma.sale.findMany({
        where: { businessId },
        include: { lines: true, invoice: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      this.prisma.payment.findMany({ where: { businessId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
      this.prisma.expense.findMany({ where: { businessId }, orderBy: { date: "desc" } }),
      this.prisma.stockCheck.findMany({ where: { businessId }, orderBy: { date: "desc" } }),
      this.prisma.product.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } }),
      this.prisma.productItem.findMany({ where: { businessId }, orderBy: { name: "asc" } }),
      this.prisma.productCategory.findMany({ where: { businessId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
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
    ]);

    return {
      version: 2,
      suppliers,
      customers,
      purchases,
      sales,
      payments,
      expenses,
      stockChecks,
      products,
      productItems,
      categories,
      attributeDefs: attributeDefs.map(({ options: _options, ...def }) => def),
      attributeOptions: attributeDefs.flatMap((def) => def.options),
      variants,
      warehouses: warehouses.map(({ locations: _locations, ...warehouse }) => warehouse),
      locations: warehouses.flatMap((warehouse) => warehouse.locations),
    };
  }

  async getPreferences(businessId: string) {
    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { settings: true },
    });
    return { data: business.settings ?? {} };
  }

  async savePreferences(businessId: string, data: Record<string, unknown>) {
    const settings = data as Prisma.InputJsonObject;
    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: { settings },
      select: { settings: true },
    });
    return { data: business.settings ?? {} };
  }
}
