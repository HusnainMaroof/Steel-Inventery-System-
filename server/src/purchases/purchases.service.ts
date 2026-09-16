import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { purchaseGoodsTotal } from "../domain/money";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePurchaseDto } from "./dto/create-purchase.dto";

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * §8/§12: purchase + lines + inventory ledger rows are created inside one
   * PostgreSQL transaction. Supplier payable is derived (goods − paid), so
   * nothing else needs updating.
   */
  async create(businessId: string, dto: CreatePurchaseDto) {
    if (dto.lines.length === 0) {
      throw new BadRequestException("A purchase needs at least one line");
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
          type: "PURCHASE" as const,
          qty: line.qty,
          referenceType: "PURCHASE",
          referenceId: purchase.id,
          date: new Date(dto.date),
        })),
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
}
