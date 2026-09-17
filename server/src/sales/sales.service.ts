import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { assertMoney, assertQty, LIMITS } from "../common/security/limits";
import {
  sanitizeAttributeSnapshot,
  sanitizeOptionalText,
} from "../common/security/sanitize-text";
import { PrismaService } from "../prisma/prisma.service";
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
    if (dto.lines.length > LIMITS.MAX_LINES_PER_DOC) {
      throw new BadRequestException(
        `A sale cannot have more than ${LIMITS.MAX_LINES_PER_DOC} lines`,
      );
    }
    dto.notes = sanitizeOptionalText(dto.notes, 300);
    assertMoney(dto.loadingCharges ?? 0, "Loading charges");
    assertMoney(dto.transportCharges ?? 0, "Transport charges");
    assertMoney(dto.labourCharges ?? 0, "Labour charges");
    assertMoney(dto.paidNow ?? 0, "Paid now");
    for (const line of dto.lines) {
      assertQty(line.qty);
      assertMoney(line.rate, "Rate");
      line.item = line.item.trim().slice(0, 80);
      line.attributeSnapshot = sanitizeAttributeSnapshot(line.attributeSnapshot);
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
      for (const line of dto.lines) {
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
        if (line.purchaseId) {
          const purchase = await tx.purchase.findFirst({
            where: {
              id: line.purchaseId,
              businessId,
              lines: {
                some: {
                  productId: line.productId,
                  ...(line.variantId ? { variantId: line.variantId } : {}),
                },
              },
            },
            include: { lines: true },
          });
          if (!purchase) throw new BadRequestException("Source purchase lot not found");
          const bought = purchase.lines
            .filter(
              (purchaseLine) =>
                purchaseLine.productId === line.productId &&
                (!line.variantId || purchaseLine.variantId === line.variantId),
            )
            .reduce((sum, purchaseLine) => sum + Number(purchaseLine.qty), 0);
          const alreadySold = await tx.saleLine.aggregate({
            where: {
              purchaseId: line.purchaseId,
              productId: line.productId,
              ...(line.variantId ? { variantId: line.variantId } : {}),
              sale: { businessId },
            },
            _sum: { qty: true },
          });
          const requestedFromLot = dto.lines
            .filter(
              (candidate) =>
                candidate.purchaseId === line.purchaseId &&
                candidate.productId === line.productId &&
                candidate.variantId === line.variantId,
            )
            .reduce((sum, candidate) => sum + candidate.qty, 0);
          if (requestedFromLot > bought - Number(alreadySold._sum.qty ?? 0) + 0.0005) {
            throw new BadRequestException("Insufficient inventory in source purchase lot");
          }
        }
      }

      // §22 edge case — sell more than available ⇒ reject, nothing written.
      const ledger = await tx.inventoryTransaction.groupBy({
        by: ["productId", "variantId"],
        where: { businessId },
        _sum: { qty: true },
      });
      const productLevels = new Map<string, number>();
      const variantLevels = new Map<string, number>();
      for (const row of ledger) {
        const qty = Number(row._sum.qty ?? 0);
        productLevels.set(row.productId, (productLevels.get(row.productId) ?? 0) + qty);
        if (row.variantId) variantLevels.set(`${row.productId}:${row.variantId}`, qty);
      }
      const requested = new Map<string, { productId: string; variantId?: string; qty: number }>();
      for (const line of dto.lines) {
        const key = line.variantId ? `${line.productId}:${line.variantId}` : line.productId;
        const current = requested.get(key);
        requested.set(key, {
          productId: line.productId,
          variantId: line.variantId,
          qty: (current?.qty ?? 0) + line.qty,
        });
      }
      const shortages = [...requested.values()].filter((line) => {
        const available = line.variantId
          ? variantLevels.get(`${line.productId}:${line.variantId}`) ?? 0
          : productLevels.get(line.productId) ?? 0;
        return line.qty > available + 0.0005;
      });
      if (shortages.length > 0) {
        const first = shortages[0];
        const available = first.variantId
          ? variantLevels.get(`${first.productId}:${first.variantId}`) ?? 0
          : productLevels.get(first.productId) ?? 0;
        throw new BadRequestException(
          `Insufficient inventory for ${shortages.length} product(s) — ` +
            `first shortage: requested ${first.qty}, available ${available}`,
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
          categoryId: line.categoryId,
          variantId: line.variantId,
          saleLineId: line.id,
          attributeSnapshot: line.attributeSnapshot ?? undefined,
          unit: line.unit,
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
          customer: { select: { id: true, name: true, shop: true, phone: true } },
          invoice: true,
          lines: true,
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
          categoryId: line.categoryId,
          variantId: line.variantId,
          saleLineId: line.id,
          attributeSnapshot: line.attributeSnapshot ?? undefined,
          unit: line.unit,
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
