import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

type LineRef = {
  productId: string;
  categoryId?: string;
  variantId?: string;
  warehouseId?: string;
  locationId?: string;
};

/**
 * Batch-validates catalogue/storage references for purchase/sale lines.
 * Replaces per-line findFirst loops with a fixed number of findMany calls.
 */
export async function assertLineReferences(
  tx: Prisma.TransactionClient,
  businessId: string,
  lines: LineRef[],
): Promise<void> {
  const categoryIds = [...new Set(lines.map((l) => l.categoryId).filter(Boolean))] as string[];
  const variantIds = [...new Set(lines.map((l) => l.variantId).filter(Boolean))] as string[];
  const warehouseIds = [...new Set(lines.map((l) => l.warehouseId).filter(Boolean))] as string[];
  const locationIds = [...new Set(lines.map((l) => l.locationId).filter(Boolean))] as string[];

  const [categories, variants, warehouses, locations] = await Promise.all([
    categoryIds.length
      ? tx.productCategory.findMany({
          where: { id: { in: categoryIds }, businessId },
          select: { id: true, productId: true },
        })
      : Promise.resolve([]),
    variantIds.length
      ? tx.variant.findMany({
          where: { id: { in: variantIds }, businessId },
          select: { id: true, productId: true, categoryId: true },
        })
      : Promise.resolve([]),
    warehouseIds.length
      ? tx.warehouse.findMany({
          where: { id: { in: warehouseIds }, businessId },
          select: { id: true },
        })
      : Promise.resolve([]),
    locationIds.length
      ? tx.location.findMany({
          where: { id: { in: locationIds }, businessId },
          select: { id: true, warehouseId: true },
        })
      : Promise.resolve([]),
  ]);

  const categoryById = new Map(categories.map((row) => [row.id, row]));
  const variantById = new Map(variants.map((row) => [row.id, row]));
  const warehouseById = new Map(warehouses.map((row) => [row.id, row]));
  const locationById = new Map(locations.map((row) => [row.id, row]));

  for (const line of lines) {
    if (line.categoryId) {
      const category = categoryById.get(line.categoryId);
      if (!category || category.productId !== line.productId) {
        throw new BadRequestException("Category not found for product");
      }
    }
    if (line.variantId) {
      const variant = variantById.get(line.variantId);
      if (
        !variant ||
        variant.productId !== line.productId ||
        (line.categoryId && variant.categoryId !== line.categoryId)
      ) {
        throw new BadRequestException("Variant not found for product");
      }
    }
    if (line.warehouseId && !warehouseById.has(line.warehouseId)) {
      throw new BadRequestException("Warehouse not found");
    }
    if (line.locationId) {
      const location = locationById.get(line.locationId);
      if (
        !location ||
        (line.warehouseId && location.warehouseId !== line.warehouseId)
      ) {
        throw new BadRequestException("Location not found");
      }
    }
  }
}
