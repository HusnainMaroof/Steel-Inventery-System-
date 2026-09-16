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
        select: { id: true },
      });
      if (!product) {
        // Thrown inside the transaction → everything rolls back.
        throw new BadRequestException("Product not found");
      }
      return tx.inventoryTransaction.create({
        data: {
          businessId,
          productId: dto.productId,
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
