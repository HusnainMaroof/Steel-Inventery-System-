import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, type Purchase, type PurchaseLine } from "@prisma/client";
import { landedCostPerUnit } from "../domain/money";
import { lockInventoryKeys, stockLockKey } from "../common/inventory/stock-locks";
import { PrismaService } from "../prisma/prisma.service";
import { AdjustInventoryDto } from "./dto/adjust-inventory.dto";

type LotPurchase = Purchase & { supplier: { name: string }; lines: PurchaseLine[] };

const lotGroupKey = (purchaseId: string, productId: string, variantId: string | null) =>
  `${purchaseId}:${productId}:${variantId ?? ""}`;

/**
 * Builds lot rows for one purchase.
 *
 * Sold qty is recorded per purchase/product/variant, not per line. When a group
 * has more than one line, the sold qty cannot be attributed to a single line.
 * Such a group is returned once, with the group remaining and `ambiguous: true`,
 * and no per-line remaining is invented. Lot-specific fields are left empty for it.
 */
export function purchaseLotRows(purchase: LotPurchase, consumedBy: Map<string, Prisma.Decimal>) {
  const goods = purchase.lines.reduce(
    (sum, line) => sum.plus(new Prisma.Decimal(line.qty).times(line.rate)),
    new Prisma.Decimal(0),
  );
  const charges = new Prisma.Decimal(purchase.transport)
    .plus(purchase.loading)
    .plus(purchase.labour)
    .plus(purchase.otherCost);
  const allocatedChargesFor = (line: PurchaseLine) => {
    const lineGoods = new Prisma.Decimal(line.qty).times(line.rate);
    return goods.gt(0) ? charges.times(lineGoods).div(goods) : new Prisma.Decimal(0);
  };

  const groups = new Map<string, PurchaseLine[]>();
  for (const line of purchase.lines) {
    const key = lotGroupKey(purchase.id, line.productId, line.variantId);
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }

  const rows = [...groups].map(([key, group]) => {
    const first = group[0];
    const ambiguous = group.length > 1;
    const sold = consumedBy.get(key) ?? new Prisma.Decimal(0);
    const groupQty = group.reduce((sum, line) => sum.plus(line.qty), new Prisma.Decimal(0));
    const remainingQty = Prisma.Decimal.max(0, groupQty.minus(sold));
    // Unit cost stays unrounded here. Only the API number is converted below.
    const landedPerUnit = ambiguous
      ? groupQty.gt(0)
        ? group
            .reduce(
              (sum, line) =>
                sum
                  .plus(new Prisma.Decimal(line.qty).times(line.rate))
                  .plus(allocatedChargesFor(line)),
              new Prisma.Decimal(0),
            )
            .div(groupQty)
        : new Prisma.Decimal(0)
      : landedCostPerUnit({
          qty: first.qty,
          rate: first.rate,
          purchaseCharges: allocatedChargesFor(first),
        });
    // Lot-specific fields belong to one line only, so they are dropped for ambiguous groups.
    const own = <T,>(value: T) => (ambiguous ? undefined : value);
    return {
      purchaseId: purchase.id,
      purchaseLineId: own(first.id),
      purchaseLineIds: group.map((line) => line.id),
      ambiguous,
      item: first.item,
      product: first.productName ?? undefined,
      spec: first.spec ?? undefined,
      quality: first.quality ?? undefined,
      supplierId: purchase.supplierId,
      unit: first.unit,
      remainingQty: remainingQty.toNumber(),
      landedPerUnit: landedPerUnit.toNumber(),
      sellPrice: own(first.sellRate == null ? undefined : first.sellRate.toNumber()),
      purchasedAt: purchase.date,
      supplierName: purchase.supplier.name,
      categoryId: first.categoryId ?? undefined,
      variantId: first.variantId ?? undefined,
      attributeSnapshot: first.attributeSnapshot ?? undefined,
      lotNumber: own(first.lotNumber ?? undefined),
      heatNumber: own(first.heatNumber ?? undefined),
      batchNumber: own(first.batchNumber ?? undefined),
      warehouseId: own(first.warehouseId ?? undefined),
      locationId: own(first.locationId ?? undefined),
    };
  });
  return rows.filter((row) => row.remainingQty > 0);
}

export type ProductUnitStockRow = {
  productId: string;
  unit: string | null;
  _sum: { qty: Prisma.Decimal | number | null };
};

/**
 * Unit-safe product stock. Each product's ledger rows are grouped by unit.
 * Units are never summed together. The qty of a single-unit product is exact
 * Decimal. A multi-unit product gets `qty: null` and a per-unit breakdown.
 * No conversion factor is applied, because none is defined in the system.
 */
export function unitSafeProductStock(
  products: { id: string; name: string; unit: string }[],
  rows: ProductUnitStockRow[],
) {
  return products.map((product) => {
    const byUnit = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      if (row.productId !== product.id) continue;
      const unit = row.unit || product.unit;
      const previous = byUnit.get(unit) ?? new Prisma.Decimal(0);
      byUnit.set(unit, previous.plus(row._sum.qty ?? 0));
    }
    const units = [...byUnit].map(([unit, qty]) => ({ unit, qty }));
    const base = { productId: product.id, productName: product.name };

    if (units.length > 1) {
      return { ...base, unit: null, qty: null, mixedUnits: true, units };
    }
    // Same shape as before for products with no ledger rows: unit = product unit, qty = 0.
    return {
      ...base,
      unit: units[0]?.unit ?? product.unit,
      qty: units[0]?.qty ?? 0,
      mixedUnits: false,
      units,
    };
  });
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Current stock per product, computed by summing the signed ledger.
   * Quantities are grouped by unit. Units are never added together.
   * A product with one unit returns that qty. A product with several units
   * returns `qty: null`, `unit: null`, `mixedUnits: true` and a `units` breakdown.
   */
  async stock(businessId: string) {
    const [grouped, products] = await Promise.all([
      this.prisma.inventoryTransaction.groupBy({
        by: ["productId", "unit"],
        where: { businessId },
        _sum: { qty: true },
      }),
      this.prisma.product.findMany({
        where: { businessId, active: true },
        select: { id: true, name: true, unit: true },
      }),
    ]);

    return unitSafeProductStock(products, grouped);
  }

  async stockByVariant(businessId: string) {
    const [grouped, products, categories, variants] = await Promise.all([
      this.prisma.inventoryTransaction.groupBy({
        by: ["productId", "categoryId", "variantId", "unit"],
        where: { businessId },
        _sum: { qty: true },
      }),
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
        // Decimal kept through the service. The JSON serializer writes qty at 3 decimals.
        stockQty: new Prisma.Decimal(row._sum.qty ?? 0),
      };
    });
  }

  async lots(businessId: string, skip: number, take: number) {
    const where = { businessId };
    const purchases = await this.prisma.purchase.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        lines: true,
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      skip,
      take,
    });
    const purchaseIds = purchases.map((purchase) => purchase.id);
    const consumed =
      purchaseIds.length > 0
        ? await this.prisma.saleLine.groupBy({
            by: ["purchaseId", "productId", "variantId"],
            where: {
              sale: { businessId },
              purchaseId: { in: purchaseIds },
            },
            _sum: { qty: true },
          })
        : [];
    const consumedBy = new Map(
      consumed.map((row) => [
        lotGroupKey(row.purchaseId ?? "", row.productId, row.variantId),
        new Prisma.Decimal(row._sum.qty ?? 0),
      ]),
    );
    return purchases.flatMap((purchase) => purchaseLotRows(purchase, consumedBy));
  }

  async lotsCount(businessId: string) {
    return this.prisma.purchase.count({ where: { businessId } });
  }

  async movements(
    businessId: string,
    skip: number,
    take: number,
    filter: { productId?: string; from?: string; to?: string },
  ) {
    const where = {
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
    };
    const [items, total] = await Promise.all([
      this.prisma.inventoryTransaction.findMany({
        where,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip,
        take,
      }),
      this.prisma.inventoryTransaction.count({ where }),
    ]);
    return [items, total] as const;
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
      // Same product-level key that sales and purchase edits take. The total
      // read below is therefore settled before this adjustment is checked.
      await lockInventoryKeys(tx, [stockLockKey(businessId, dto.productId, null)]);
      if (dto.qty < 0) {
        const agg = await tx.inventoryTransaction.aggregate({
          where: { businessId, productId: dto.productId },
          _sum: { qty: true },
        });
        const current = new Prisma.Decimal(agg._sum.qty ?? 0);
        const resulting = current.plus(dto.qty);
        if (resulting.lt(0)) {
          throw new BadRequestException(
            `Adjustment would make stock negative: available ${current.toString()}, ` +
              `adjustment ${dto.qty}`,
          );
        }
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
