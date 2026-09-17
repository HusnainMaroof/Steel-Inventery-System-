import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../common/audit/audit.service";
import { assertMoney, assertQty, LIMITS } from "../common/security/limits";
import {
  sanitizeAttributeSnapshot,
  sanitizeOptionalText,
} from "../common/security/sanitize-text";
import { purchaseGoodsTotal } from "../domain/money";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePurchaseDto } from "./dto/create-purchase.dto";
import { UpdatePurchaseDto } from "./dto/update-purchase.dto";

export function replacementStockShortage(
  stockWithoutPurchase: Array<{ productId: string; qty: number }>,
  replacementLines: Array<{ productId: string; qty: number }>,
): string | undefined {
  const stock = new Map(stockWithoutPurchase.map((row) => [row.productId, row.qty]));
  for (const line of replacementLines) {
    stock.set(line.productId, (stock.get(line.productId) ?? 0) + line.qty);
  }
  return [...stock.entries()].find(([, qty]) => qty < -0.0005)?.[0];
}

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * §8/§12: purchase + lines + inventory ledger rows are created inside one
   * PostgreSQL transaction. Supplier payable is derived (goods − paid), so
   * nothing else needs updating.
   */
  async create(businessId: string, dto: CreatePurchaseDto, actorId?: string) {
    if (dto.lines.length === 0) {
      throw new BadRequestException("A purchase needs at least one line");
    }
    if (dto.lines.length > LIMITS.MAX_LINES_PER_DOC) {
      throw new BadRequestException(
        `A purchase cannot have more than ${LIMITS.MAX_LINES_PER_DOC} lines`,
      );
    }
    dto.notes = sanitizeOptionalText(dto.notes, 300);
    assertMoney(dto.transport ?? 0, "Transport");
    assertMoney(dto.loading ?? 0, "Loading");
    assertMoney(dto.labour ?? 0, "Labour");
    assertMoney(dto.otherCost ?? 0, "Other cost");
    assertMoney(dto.paid ?? 0, "Paid amount");
    for (const line of dto.lines) {
      assertQty(line.qty);
      assertMoney(line.rate, "Rate");
      if (line.sellRate != null) assertMoney(line.sellRate, "Sell rate");
      line.item = line.item.trim().slice(0, 80);
      line.attributeSnapshot = sanitizeAttributeSnapshot(line.attributeSnapshot);
    }

    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id: dto.supplierId, businessId },
        select: { id: true },
      });
      if (!supplier) throw new BadRequestException("Supplier not found");

      const productIds = [...new Set(dto.lines.map((l) => l.productId))];
      const products = await tx.product.findMany({
        where: { businessId, id: { in: productIds } },
        select: { id: true },
      });
      if (products.length !== productIds.length) {
        throw new BadRequestException("One or more products were not found");
      }
      await this.validateReferences(tx, businessId, dto.supplierId, dto.lines);

      const goodsTotal = purchaseGoodsTotal(dto.lines);
      const paid = dto.paid ?? 0;
      if (paid > goodsTotal + 0.005) {
        throw new BadRequestException(
          `Paid amount (${paid}) cannot exceed the goods total (${goodsTotal})`,
        );
      }

      const purchase = await tx.purchase.create({
        data: {
          businessId,
          date: new Date(dto.date),
          supplierId: dto.supplierId,
          notes: dto.notes,
          transport: dto.transport ?? 0,
          loading: dto.loading ?? 0,
          labour: dto.labour ?? 0,
          otherCost: dto.otherCost ?? 0,
          paid,
          lines: {
            create: dto.lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              categoryId: line.categoryId,
              item: line.item,
              attributeSnapshot: line.attributeSnapshot ?? undefined,
              qty: line.qty,
              unit: line.unit,
              rate: line.rate,
              sellRate: line.sellRate,
              productName: line.productName,
              spec: line.spec,
              quality: line.quality,
              lotNumber: line.lotNumber,
              heatNumber: line.heatNumber,
              batchNumber: line.batchNumber,
              warehouseId: line.warehouseId,
              locationId: line.locationId,
            })),
          },
        },
        include: { lines: true },
      });

      // §7 — every stock increase is a traceable ledger row.
      await tx.inventoryTransaction.createMany({
        data: purchase.lines.map((line) => ({
          businessId,
          productId: line.productId,
          categoryId: line.categoryId,
          variantId: line.variantId,
          purchaseLineId: line.id,
          warehouseId: line.warehouseId,
          locationId: line.locationId,
          attributeSnapshot: line.attributeSnapshot ?? undefined,
          unit: line.unit,
          refLabel: [line.lotNumber, line.heatNumber, line.batchNumber].filter(Boolean).join(" / ") || undefined,
          type: "PURCHASE" as const,
          qty: line.qty,
          referenceType: "PURCHASE",
          referenceId: purchase.id,
          date: new Date(dto.date),
        })),
      });

      if (paid > 0) {
        await tx.payment.create({
          data: {
            businessId,
            date: new Date(dto.date),
            type: "SUPPLIER",
            supplierId: dto.supplierId,
            amount: paid,
            method: "CASH",
            note: `Payment recorded with purchase ${purchase.id}`,
          },
        });
      }

      await this.audit.logTx(tx, {
        businessId,
        actorId: actorId ?? null,
        action: "purchase.created",
        entityType: "purchase",
        entityId: purchase.id,
        metadata: { supplierId: dto.supplierId, lineCount: dto.lines.length },
      });

      return purchase;
    });
  }

  async list(businessId: string, skip: number, take: number, supplierId?: string) {
    const where = {
      businessId,
      ...(supplierId ? { supplierId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.purchase.findMany({
        where,
        skip,
        take,
        include: {
          supplier: { select: { id: true, name: true, mill: true } },
          lines: { include: { product: { select: { id: true, name: true, unit: true } } } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      this.prisma.purchase.count({ where }),
    ]);
    return [items, total] as const;
  }

  async byId(businessId: string, id: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, businessId },
      include: {
        supplier: true,
        lines: { include: { product: { select: { id: true, name: true, unit: true } } } },
      },
    });
    if (!purchase) throw new NotFoundException("Purchase not found");
    return purchase;
  }

  async update(businessId: string, id: string, dto: UpdatePurchaseDto, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.purchase.findFirst({
        where: { id, businessId },
        include: { lines: true },
      });
      if (!current) throw new NotFoundException("Purchase not found");
      if (dto.lines) {
        const sourcedSales = await tx.saleLine.count({
          where: { purchaseId: id, sale: { businessId } },
        });
        if (sourcedSales) {
          throw new BadRequestException("Cannot replace purchase lines after stock from this lot was sold");
        }
      }

      const lines = dto.lines ?? current.lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId ?? undefined,
        categoryId: line.categoryId ?? undefined,
        item: line.item,
        attributeSnapshot: line.attributeSnapshot as Record<string, string> | undefined,
        qty: Number(line.qty),
        unit: line.unit,
        rate: Number(line.rate),
        sellRate: line.sellRate == null ? undefined : Number(line.sellRate),
        productName: line.productName ?? undefined,
        spec: line.spec ?? undefined,
        quality: line.quality ?? undefined,
        lotNumber: line.lotNumber ?? undefined,
        heatNumber: line.heatNumber ?? undefined,
        batchNumber: line.batchNumber ?? undefined,
        warehouseId: line.warehouseId ?? undefined,
        locationId: line.locationId ?? undefined,
      }));
      if (!lines.length) throw new BadRequestException("A purchase needs at least one line");

      await this.validateReferences(tx, businessId, dto.supplierId ?? current.supplierId, lines);
      await this.assertReplacementLeavesNonNegativeStock(tx, businessId, id, lines);

      const goodsTotal = purchaseGoodsTotal(lines);
      const paid = dto.paid ?? Number(current.paid);
      if (paid > goodsTotal + 0.005) {
        throw new BadRequestException(`Paid amount (${paid}) cannot exceed the goods total (${goodsTotal})`);
      }

      await tx.inventoryTransaction.deleteMany({
        where: { businessId, referenceType: "PURCHASE", referenceId: id },
      });
      await tx.purchaseLine.deleteMany({ where: { purchaseId: id } });
      const purchase = await tx.purchase.update({
        where: { id },
        data: {
          date: dto.date ? new Date(dto.date) : undefined,
          supplierId: dto.supplierId,
          notes: dto.notes,
          transport: dto.transport,
          loading: dto.loading,
          labour: dto.labour,
          otherCost: dto.otherCost,
          paid,
          lines: { create: lines },
        },
        include: { lines: true },
      });
      await this.createMovements(tx, businessId, purchase);
      await this.audit.logTx(tx, {
        businessId,
        actorId: actorId ?? null,
        action: "purchase.updated",
        entityType: "purchase",
        entityId: purchase.id,
      });
      return purchase;
    });
  }

  async remove(businessId: string, id: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id, businessId },
        include: { lines: true },
      });
      if (!purchase) throw new NotFoundException("Purchase not found");
      const sourcedSales = await tx.saleLine.count({
        where: { purchaseId: id, sale: { businessId } },
      });
      if (sourcedSales) {
        throw new BadRequestException("Cannot delete a purchase lot referenced by sales");
      }
      await this.assertReplacementLeavesNonNegativeStock(tx, businessId, id, []);
      await tx.inventoryTransaction.deleteMany({
        where: { businessId, referenceType: "PURCHASE", referenceId: id },
      });
      await tx.purchase.delete({ where: { id } });
      await this.audit.logTx(tx, {
        businessId,
        actorId: actorId ?? null,
        action: "purchase.deleted",
        entityType: "purchase",
        entityId: id,
      });
      return { deleted: true, purchaseId: id };
    });
  }

  private async validateReferences(
    tx: Prisma.TransactionClient,
    businessId: string,
    supplierId: string,
    lines: Array<{
      productId: string;
      categoryId?: string;
      variantId?: string;
      warehouseId?: string;
      locationId?: string;
    }>,
  ) {
    const supplier = await tx.supplier.findFirst({ where: { id: supplierId, businessId } });
    if (!supplier) throw new BadRequestException("Supplier not found");
    const productIds = [...new Set(lines.map((line) => line.productId))];
    if (await tx.product.count({ where: { businessId, id: { in: productIds } } }) !== productIds.length) {
      throw new BadRequestException("One or more products were not found");
    }
    for (const line of lines) {
      if (line.categoryId) {
        const category = await tx.productCategory.findFirst({
          where: { id: line.categoryId, businessId, productId: line.productId },
        });
        if (!category) throw new BadRequestException("Category not found for product");
      }
      if (line.variantId) {
        const variant = await tx.variant.findFirst({
          where: {
            id: line.variantId,
            businessId,
            productId: line.productId,
            ...(line.categoryId ? { categoryId: line.categoryId } : {}),
          },
        });
        if (!variant) throw new BadRequestException("Variant not found for product");
      }
      if (line.warehouseId) {
        const warehouse = await tx.warehouse.findFirst({ where: { id: line.warehouseId, businessId } });
        if (!warehouse) throw new BadRequestException("Warehouse not found");
      }
      if (line.locationId) {
        const location = await tx.location.findFirst({
          where: { id: line.locationId, businessId, ...(line.warehouseId ? { warehouseId: line.warehouseId } : {}) },
        });
        if (!location) throw new BadRequestException("Location not found");
      }
    }
  }

  private async assertReplacementLeavesNonNegativeStock(
    tx: Prisma.TransactionClient,
    businessId: string,
    purchaseId: string,
    lines: Array<{ productId: string; qty: number }>,
  ) {
    const grouped = await tx.inventoryTransaction.groupBy({
      by: ["productId"],
      where: { businessId, NOT: { referenceType: "PURCHASE", referenceId: purchaseId } },
      _sum: { qty: true },
    });
    const shortage = replacementStockShortage(
      grouped.map((row) => ({ productId: row.productId, qty: Number(row._sum.qty ?? 0) })),
      lines,
    );
    if (shortage) {
      throw new BadRequestException("Purchase change would make existing sold stock negative");
    }
  }

  private createMovements(
    tx: Prisma.TransactionClient,
    businessId: string,
    purchase: { id: string; date: Date; lines: Array<{
      id: string; productId: string; categoryId: string | null; variantId: string | null;
      warehouseId: string | null; locationId: string | null; attributeSnapshot: Prisma.JsonValue;
      unit: string; qty: Prisma.Decimal; lotNumber: string | null; heatNumber: string | null; batchNumber: string | null;
    }> },
  ) {
    return tx.inventoryTransaction.createMany({
      data: purchase.lines.map((line) => ({
        businessId,
        productId: line.productId,
        categoryId: line.categoryId,
        variantId: line.variantId,
        purchaseLineId: line.id,
        warehouseId: line.warehouseId,
        locationId: line.locationId,
        attributeSnapshot: line.attributeSnapshot == null
          ? undefined
          : line.attributeSnapshot as Prisma.InputJsonValue,
        unit: line.unit,
        type: "PURCHASE" as const,
        qty: line.qty,
        referenceType: "PURCHASE",
        referenceId: purchase.id,
        refLabel: [line.lotNumber, line.heatNumber, line.batchNumber].filter(Boolean).join(" / ") || undefined,
        date: purchase.date,
      })),
    });
  }
}
