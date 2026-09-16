import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStockCheckDto } from "./dto/create-stock-check.dto";

@Injectable()
export class StockChecksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A count is stored together with the system quantity at that moment —
   * so the difference stays historically true even as stock moves later.
   */
  async create(businessId: string, dto: CreateStockCheckDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: dto.productId, businessId },
        select: { id: true },
      });
      if (!product) throw new BadRequestException("Product not found");

      const grouped = await tx.inventoryTransaction.aggregate({
        where: { businessId, productId: dto.productId },
        _sum: { qty: true },
      });
      const systemQty = Number(grouped._sum.qty ?? 0);

      return tx.stockCheck.create({
        data: {
          businessId,
          date: new Date(dto.date),
          productId: dto.productId,
          physicalQty: dto.physicalQty,
          systemQty,
        },
      });
    });
  }

  async systemQty(businessId: string, productId: string) {
    const grouped = await this.prisma.inventoryTransaction.aggregate({
      where: { businessId, productId },
      _sum: { qty: true },
    });
    return { systemQty: Number(grouped._sum.qty ?? 0) };
  }

  list(businessId: string, from?: string, to?: string) {
    return this.prisma.stockCheck.findMany({
      where: {
        businessId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: { product: { select: { id: true, name: true, unit: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 500,
    });
  }
}
