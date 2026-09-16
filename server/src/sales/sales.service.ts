import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { findShortages, stockLevelsFromLedger } from "../domain/sale-availability";
import { saleGrandTotal } from "../domain/money";
import { CreateSaleDto } from "./dto/create-sale.dto";

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * §9/§12 — atomic sale creation. Availability is checked against the
   * inventory ledger inside the same transaction; an oversell throws and
   * every partial write rolls back.
   */
  async create(businessId: string, dto: CreateSaleDto) {
    if (dto.lines.length === 0) {
      throw new BadRequestException("A sale needs at least one line");
    }

    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: dto.customerId, businessId },
        select: { id: true },
      });
      if (!customer) throw new BadRequestException("Customer not found");

      const productIds = [...new Set(dto.lines.map((l) => l.productId))];
      const products = await tx.product.findMany({
        where: { businessId, id: { in: productIds } },
        select: { id: true },
      });
      if (products.length !== productIds.length) {
        throw new BadRequestException("One or more products were not found");
      }

      // §22 edge case — sell more than available ⇒ reject, nothing written.
      const ledger = await tx.inventoryTransaction.groupBy({
        by: ["productId"],
        where: { businessId },
        _sum: { qty: true },
      });
      const levels = stockLevelsFromLedger(
        ledger.map((g) => ({ productId: g.productId, qty: Number(g._sum.qty ?? 0) })),
      );
      const shortages = findShortages(
        levels,
        dto.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
      );
      if (shortages.length > 0) {
        const first = shortages[0];
        throw new BadRequestException(
          `Insufficient inventory for ${shortages.length} product(s) — ` +
            `first shortage: requested ${first.requested}, available ${first.available}`,
        );
      }

      const totals = saleGrandTotal(
        dto.lines.map((l) => ({ qty: l.qty, rate: l.rate })),
        {
          discountPct: dto.discountPct ?? 0,
          taxPct: dto.taxPct ?? 0,
          loading: dto.loadingCharges ?? 0,
          transport: dto.transportCharges ?? 0,
          labour: dto.labourCharges ?? 0,
        },
      );

      const sale = await tx.sale.create({
        data: {
          businessId,
          date: new Date(dto.date),
          customerId: dto.customerId,
          notes: dto.notes,
          discountPct: dto.discountPct ?? 0,
          taxPct: dto.taxPct ?? 0,
          loadingCharges: dto.loadingCharges ?? 0,
          transportCharges: dto.transportCharges ?? 0,
          labourCharges: dto.labourCharges ?? 0,
          lines: {
            create: dto.lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              categoryId: line.categoryId,
              purchaseId: line.purchaseId, // source lot traceability
              item: line.item,
              attributeSnapshot: line.attributeSnapshot ?? undefined,
              qualityName: line.qualityName,
              qty: line.qty,
              unit: line.unit,
              rate: line.rate,
            })),
          },
        },
        include: { lines: true },
      });

      // §7 — every stock decrease is a traceable ledger row (signed −qty).
      await tx.inventoryTransaction.createMany({
        data: sale.lines.map((line) => ({
          businessId,
          productId: line.productId,
          type: "SALE" as const,
          qty: -line.qty,
          referenceType: "SALE",
          referenceId: sale.id,
          date: new Date(dto.date),
        })),
      });

      // Invoice generated with the sale (§9).
      const count = await tx.invoice.count({ where: { businessId } });
      const invoice = await tx.invoice.create({
        data: {
          businessId,
          saleId: sale.id,
          number: `INV-${String(count + 1).padStart(4, "0")}`,
          total: totals.grandTotal,
        },
      });

      // Amount paid now (if any) immediately settles the new invoice.
      if (dto.paidNow && dto.paidNow > 0) {
        if (dto.paidNow > totals.grandTotal + 0.005) {
          throw new BadRequestException(
            `Paid-now amount (${dto.paidNow}) exceeds the invoice total (${totals.grandTotal})`,
          );
        }
        const payment = await tx.payment.create({
          data: {
            businessId,
            date: new Date(dto.date),
            type: "CUSTOMER",
            customerId: dto.customerId,
            amount: dto.paidNow,
            method: "CASH",
            saleId: sale.id,
          },
        });
        await tx.paymentAllocation.create({
          data: {
            businessId,
            paymentId: payment.id,
            saleId: sale.id,
            amount: dto.paidNow,
          },
        });
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { paid: dto.paidNow },
        });
      }

      return { sale, invoice: { ...invoice, total: totals.grandTotal } };
    });
  }

  async list(businessId: string, skip: number, take: number, customerId?: string) {
    const where: Prisma.SaleWhereInput = {
      businessId,
      ...(customerId ? { customerId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        skip,
        take,
        include: {
          customer: { select: { id: true, name: true, shop: true } },
          invoice: true,
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      this.prisma.sale.count({ where }),
    ]);
    return [items, total] as const;
  }

  async byId(businessId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        invoice: true,
        lines: { include: { product: { select: { id: true, name: true, unit: true } } } },
      },
    });
    if (!sale) throw new NotFoundException("Sale not found");
    return sale;
  }

  /** Delete = reversal ledger rows + invoice gone + allocations gone, atomically. */
  async remove(businessId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id, businessId },
        include: { invoice: true, lines: true },
      });
      if (!sale) throw new NotFoundException("Sale not found");

      await tx.inventoryTransaction.createMany({
        data: sale.lines.map((line) => ({
          businessId,
          productId: line.productId,
          type: "RETURN" as const,
          qty: line.qty, // goods come back
          referenceType: "SALE_DELETE",
          referenceId: sale.id,
          date: sale.date,
        })),
      });
      if (sale.invoice) {
        await tx.paymentAllocation.deleteMany({
          where: { saleId: sale.id },
        });
        await tx.payment.deleteMany({
          where: { businessId, saleId: sale.id },
        });
        await tx.invoice.delete({ where: { id: sale.invoice.id } });
      }
      await tx.sale.delete({ where: { id: sale.id } });
      return { deleted: true, saleId: sale.id };
    });
  }
}
