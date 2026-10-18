import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { rethrowNotFound } from "../common/prisma/query-helpers";
import { purchaseGoodsTotal } from "../domain/money";
import { supplierPayable } from "../domain/payment-settlement";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  create(businessId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: { businessId, name: dto.name, mill: dto.mill, phone: dto.phone },
    });
  }

  async list(businessId: string, skip: number, take: number, search?: string) {
    const where: Prisma.SupplierWhereInput = {
      ...this.baseWhere(businessId),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { mill: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return [items, total] as const;
  }

  /** Bulk fetch for /ledger/transactions — one findMany, no count. */
  listAll(businessId: string, take: number) {
    return this.prisma.supplier.findMany({
      where: this.baseWhere(businessId),
      orderBy: { createdAt: "asc" },
      take,
    });
  }

  private baseWhere(businessId: string): Prisma.SupplierWhereInput {
    return { businessId, active: true };
  }

  async byId(businessId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, businessId },
    });
    if (!supplier) throw new NotFoundException("Supplier not found");
    return supplier;
  }

  /**
   * Per-purchase payable: goods total (steel amount) − paid.
   * Transport/loading/labour/other charges are on us, never owed (§27).
   */
  async payables(businessId: string, id: string, skip: number, take: number) {
    const where = { businessId, supplierId: id };
    const [, purchases, total, dueRows] = await Promise.all([
      this.byId(businessId, id),
      this.prisma.purchase.findMany({
        where,
        include: { lines: true },
        orderBy: { date: "asc" },
        skip,
        take,
      }),
      this.prisma.purchase.count({ where }),
      this.prisma.$queryRaw<{ due: string }[]>`
        SELECT COALESCE(SUM(
          GREATEST(
            0,
            COALESCE((
              SELECT ROUND(SUM(pl."qty" * pl."rate"), 2)
              FROM "PurchaseLine" pl
              WHERE pl."purchaseId" = p."id"
            ), 0) - p."paid"
          )
        ), 0)::text AS due
        FROM "Purchase" p
        WHERE p."businessId" = ${businessId} AND p."supplierId" = ${id}
      `,
    ]);
    const rows = purchases.map((p) => {
      const goodsTotal = purchaseGoodsTotal(p.lines);
      const due = supplierPayable([{ goodsTotal, paid: p.paid }]);
      return {
        purchaseId: p.id,
        date: p.date,
        goodsTotal,
        paid: Number(p.paid),
        due,
      };
    });
    return { rows, totalDue: Number(dueRows[0]?.due ?? 0), total };
  }

  async update(businessId: string, id: string, dto: UpdateSupplierDto) {
    return this.prisma.supplier.update({
      where: { id, businessId },
      data: { name: dto.name, mill: dto.mill, phone: dto.phone },
    }).catch(rethrowNotFound("Supplier not found"));
  }

  async deactivate(businessId: string, id: string) {
    return this.prisma.supplier.update({
      where: { id, businessId },
      data: { active: false },
    }).catch(rethrowNotFound("Supplier not found"));
  }
}
