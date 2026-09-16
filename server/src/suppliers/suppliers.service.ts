import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
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
      businessId,
      active: true,
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
    const [items, total] = await this.prisma.$transaction([
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
  async payables(businessId: string, id: string) {
    await this.byId(businessId, id);
    const purchases = await this.prisma.purchase.findMany({
      where: { businessId, supplierId: id },
      include: { lines: true },
      orderBy: { date: "asc" },
    });
    const rows = purchases.map((p) => {
      const goodsTotal = Number(
        p.lines.reduce((sum, l) => sum + Number(l.qty) * Number(l.rate), 0),
      );
      const due = Math.max(0, goodsTotal - Number(p.paid));
      return {
        purchaseId: p.id,
        date: p.date,
        goodsTotal,
        paid: Number(p.paid),
        due,
      };
    });
    const totalDue = supplierPayable(
      rows.map((r) => ({ goodsTotal: r.goodsTotal, paid: r.paid })),
    );
    return { rows, totalDue };
  }

  async update(businessId: string, id: string, dto: UpdateSupplierDto) {
    await this.byId(businessId, id);
    return this.prisma.supplier.update({
      where: { id },
      data: { name: dto.name, mill: dto.mill, phone: dto.phone },
    });
  }

  async deactivate(businessId: string, id: string) {
    await this.byId(businessId, id);
    return this.prisma.supplier.update({
      where: { id },
      data: { active: false },
    });
  }
}
