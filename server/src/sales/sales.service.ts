import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../common/audit/audit.service";
import {
  lockInventoryKeys,
  lotLockKey,
  stockLockKey,
} from "../common/inventory/stock-locks";
import {
  incrementInvoicePaidOrThrow,
} from "../common/payments/invoice-atomic";
import { assertMoney, assertQty, LIMITS } from "../common/security/limits";
import {
  sanitizeAttributeSnapshot,
  sanitizeOptionalText,
} from "../common/security/sanitize-text";
import { assertLineReferences } from "../common/catalog/line-reference-validation";
import { consumedQtyByLot } from "../common/prisma/query-helpers";
import { PrismaService } from "../prisma/prisma.service";
import { saleGrandTotal } from "../domain/money";
import { CreateSaleDto } from "./dto/create-sale.dto";

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
      const lockKeys = dto.lines.flatMap((line) => {
        const keys = [stockLockKey(businessId, line.productId, line.variantId)];
        if (line.purchaseId) {
          keys.push(lotLockKey(businessId, line.purchaseId, line.productId, line.variantId));
        }
        return keys;
      });
      await lockInventoryKeys(tx, lockKeys);

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
      await assertLineReferences(tx, businessId, dto.lines);

      const purchaseIds = [
        ...new Set(dto.lines.map((l) => l.purchaseId).filter(Boolean)),
      ] as string[];
      const [purchasesWithLines, consumedByLot] = await Promise.all([
        purchaseIds.length
          ? tx.purchase.findMany({
              where: { id: { in: purchaseIds }, businessId },
              include: { lines: true },
            })
          : Promise.resolve([]),
        consumedQtyByLot(tx, businessId, purchaseIds),
      ]);
      const purchaseById = new Map(purchasesWithLines.map((p) => [p.id, p]));

      for (const line of dto.lines) {
        if (!line.purchaseId) continue;
        const purchase = purchaseById.get(line.purchaseId);
        if (!purchase) throw new BadRequestException("Source purchase lot not found");
        const matchingLines = purchase.lines.filter(
          (purchaseLine) =>
            purchaseLine.productId === line.productId &&
            (!line.variantId || purchaseLine.variantId === line.variantId),
        );
        if (matchingLines.length === 0) {
          throw new BadRequestException("Source purchase lot not found");
        }
        const bought = matchingLines.reduce(
          (sum, purchaseLine) => sum + Number(purchaseLine.qty),
          0,
        );
        const lotKey = `${line.purchaseId}:${line.productId}:${line.variantId ?? ""}`;
        const alreadySold = consumedByLot.get(lotKey) ?? 0;
        const requestedFromLot = dto.lines
          .filter(
            (candidate) =>
              candidate.purchaseId === line.purchaseId &&
              candidate.productId === line.productId &&
              candidate.variantId === line.variantId,
          )
          .reduce((sum, candidate) => sum + candidate.qty, 0);
        if (requestedFromLot > bought - alreadySold + 0.0005) {
          throw new BadRequestException("Insufficient inventory in source purchase lot");
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

      const invoice = await this.createInvoice(tx, businessId, sale.id, totals.grandTotal);

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
        await incrementInvoicePaidOrThrow(tx, businessId, invoice.id, dto.paidNow);
      }

      await this.audit.logTx(tx, {
        businessId,
        action: "sale.created",
        entityType: "sale",
        entityId: sale.id,
        metadata: { customerId: dto.customerId, lineCount: sale.lines.length },
      });

      return { sale, invoice: { ...invoice, total: totals.grandTotal } };
    });
  }

  private async createInvoice(
    tx: Prisma.TransactionClient,
    businessId: string,
    saleId: string,
    total: number,
  ) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const count = await tx.invoice.count({ where: { businessId } });
      const number = `INV-${String(count + 1).padStart(4, "0")}`;
      try {
        return await tx.invoice.create({
          data: { businessId, saleId, number, total },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          attempt < 3
        ) {
          continue;
        }
        throw err;
      }
    }
    throw new BadRequestException("Could not allocate an invoice number");
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

  /** Delete = reversal ledger rows + payment cleanup + invoice gone, atomically. */
  async remove(businessId: string, id: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id, businessId },
        include: { invoice: true, lines: true },
      });
      if (!sale) throw new NotFoundException("Sale not found");

      const lockKeys = sale.lines.flatMap((line) => [
        stockLockKey(businessId, line.productId, line.variantId),
        ...(line.purchaseId
          ? [lotLockKey(businessId, line.purchaseId, line.productId, line.variantId)]
          : []),
      ]);
      await lockInventoryKeys(tx, lockKeys);

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
          qty: line.qty,
          referenceType: "SALE_DELETE",
          referenceId: sale.id,
          date: sale.date,
        })),
      });

      const allocations = await tx.paymentAllocation.findMany({
        where: { businessId, saleId: sale.id },
        select: { paymentId: true },
      });
      const paymentIds = [...new Set(allocations.map((a) => a.paymentId))];

      await tx.paymentAllocation.deleteMany({ where: { businessId, saleId: sale.id } });
      await tx.payment.deleteMany({ where: { businessId, saleId: sale.id } });

      if (paymentIds.length > 0) {
        const withRemaining = await tx.paymentAllocation.groupBy({
          by: ["paymentId"],
          where: { paymentId: { in: paymentIds } },
        });
        const stillUsed = new Set(withRemaining.map((row) => row.paymentId));
        const orphanIds = paymentIds.filter((id) => !stillUsed.has(id));
        if (orphanIds.length > 0) {
          await tx.payment.deleteMany({
            where: { id: { in: orphanIds }, businessId, saleId: null },
          });
        }
      }

      if (sale.invoice) {
        await tx.invoice.delete({ where: { id: sale.invoice.id, businessId } });
      }
      await tx.sale.delete({ where: { id: sale.id, businessId } });

      await this.audit.logTx(tx, {
        businessId,
        actorId: actorId ?? null,
        action: "sale.deleted",
        entityType: "sale",
        entityId: sale.id,
      });

      return { deleted: true, saleId: sale.id };
    });
  }
}
