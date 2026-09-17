import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AdjustInventoryDto } from "./dto/adjust-inventory.dto";

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Current stock per product, computed by summing the signed ledger. */
  async stock(businessId: string) {
    const grouped = await this.prisma.inventoryTransaction.groupBy({
      by: ["productId"],
      where: { businessId },
      _sum: { qty: true },
    });

    const products = await this.prisma.product.findMany({
      where: { businessId, active: true },
      select: { id: true, name: true, unit: true },
    });

    const sums = new Map(grouped.map((g) => [g.productId, g._sum.qty ?? 0]));
    return products.map((p) => ({
      productId: p.id,
      productName: p.name,
      unit: p.unit,
      qty: sums.get(p.id) ?? 0,
    }));
  }

  async stockByVariant(businessId: string) {
    const grouped = await this.prisma.inventoryTransaction.groupBy({
      by: ["productId", "categoryId", "variantId", "unit"],
      where: { businessId },
      _sum: { qty: true },
    });
    const [products, categories, variants] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where: { businessId }, select: { id: true, name: true, unit: true } }),
      this.prisma.productCategory.findMany({ where: { businessId }, select: { id: true, name: true } }),
      this.prisma.variant.findMany({ where: { businessId }, select: { id: true, shortName: true, attributes: true } }),
    ]);
    const productById = new Map(products.map((row) => [row.id, row]));
    const categoryById = new Map(categories.map((row) => [row.id, row]));
    const variantById = new Map(variants.map((row) => [row.id, row]));
    return grouped.map((row) => {
      const product = productById.get(row.productId);
      const variant = row.variantId ? variantById.get(row.variantId) : undefined;
      return {
        variantId: row.variantId ?? `product:${row.productId}`,
        productId: row.productId,
        product: product?.name,
        categoryId: row.categoryId ?? undefined,
        category: row.categoryId ? categoryById.get(row.categoryId)?.name : undefined,
        shortName: variant?.shortName ?? product?.name ?? row.productId,
        attributeSnapshot: variant?.attributes ?? undefined,
        unit: row.unit || product?.unit,
        stockQty: Number(row._sum.qty ?? 0),
      };
    });
  }

  async lots(businessId: string) {
    const purchases = await this.prisma.purchase.findMany({
      where: { businessId },
      include: {
        supplier: { select: { name: true } },
        lines: true,
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
    const consumed = await this.prisma.saleLine.groupBy({
      by: ["purchaseId", "productId", "variantId"],
      where: { sale: { businessId }, purchaseId: { not: null } },
      _sum: { qty: true },
    });
    const consumedBy = new Map(
      consumed.map((row) => [
        `${row.purchaseId}:${row.productId}:${row.variantId ?? ""}`,
        Number(row._sum.qty ?? 0),
      ]),
    );
    return purchases.flatMap((purchase) => {
      const goods = purchase.lines.reduce(
        (sum, line) => sum + Number(line.qty) * Number(line.rate),
        0,
      );
      const charges =
        Number(purchase.transport) +
        Number(purchase.loading) +
        Number(purchase.labour) +
        Number(purchase.otherCost);
      return purchase.lines
        .map((line) => {
          const key = `${purchase.id}:${line.productId}:${line.variantId ?? ""}`;
          const remainingQty = Math.max(0, Number(line.qty) - (consumedBy.get(key) ?? 0));
          const lineGoods = Number(line.qty) * Number(line.rate);
          const allocatedCharges = goods > 0 ? charges * (lineGoods / goods) : 0;
          return {
            purchaseId: purchase.id,
            purchaseLineId: line.id,
            item: line.item,
            product: line.productName ?? undefined,
            spec: line.spec ?? undefined,
            quality: line.quality ?? undefined,
            supplierId: purchase.supplierId,
            unit: line.unit,
            remainingQty,
            landedPerUnit:
              Number(line.qty) > 0 ? (lineGoods + allocatedCharges) / Number(line.qty) : 0,
            sellPrice: line.sellRate == null ? undefined : Number(line.sellRate),
            purchasedAt: purchase.date,
            supplierName: purchase.supplier.name,
            categoryId: line.categoryId ?? undefined,
            variantId: line.variantId ?? undefined,
            attributeSnapshot: line.attributeSnapshot ?? undefined,
            lotNumber: line.lotNumber ?? undefined,
            heatNumber: line.heatNumber ?? undefined,
            batchNumber: line.batchNumber ?? undefined,
            warehouseId: line.warehouseId ?? undefined,
            locationId: line.locationId ?? undefined,
          };
        })
        .filter((line) => line.remainingQty > 0.0005);
    });
  }

  movements(
    businessId: string,
    filter: { productId?: string; from?: string; to?: string },
  ) {
    return this.prisma.inventoryTransaction.findMany({
      where: {
        businessId,
        ...(filter.productId ? { productId: filter.productId } : {}),
        ...(filter.from || filter.to
          ? {
              date: {
                ...(filter.from ? { gte: new Date(filter.from) } : {}),
                ...(filter.to ? { lte: new Date(filter.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 500,
    });
  }

  /** Manual stock correction — recorded as an ADJUSTMENT ledger row. */
  async adjust(businessId: string, dto: AdjustInventoryDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: dto.productId, businessId },
        select: { id: true, unit: true },
      });
      if (!product) {
        // Thrown inside the transaction → everything rolls back.
        throw new BadRequestException("Product not found");
      }
      return tx.inventoryTransaction.create({
        data: {
          businessId,
          productId: dto.productId,
          unit: product.unit,
          type: "ADJUSTMENT",
          qty: dto.qty, // signed: + adjustment in, − adjustment out
          referenceType: "ADJUSTMENT",
          referenceId: "MANUAL",
          date: new Date(dto.date),
        },
      });
    });
  }
}
