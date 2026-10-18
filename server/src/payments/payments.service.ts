import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../common/audit/audit.service";
import { newRecordId } from "../common/record-id";
import { assertMaxDecimals, assertPositiveMoney, LIMITS } from "../common/security/limits";
import { sanitizeOptionalText } from "../common/security/sanitize-text";
import { PrismaService } from "../prisma/prisma.service";
import { settleFifo, settleSupplierFifo } from "../domain/payment-settlement";
import { CreatePaymentDto } from "./dto/create-payment.dto";

const listInclude = {
  customer: { select: { id: true, name: true, shop: true } },
  supplier: { select: { id: true, name: true, mill: true } },
  allocations: true,
} satisfies Prisma.PaymentInclude;

const listOrder: Prisma.PaymentOrderByWithRelationInput[] = [
  { date: "desc" },
  { createdAt: "desc" },
];

/** One open invoice (customer) or purchase (supplier) as read for settlement. */
type OpenInvoiceRow = { saleId: string; date: string; invoiceId: string; total: string; paid: string };
type OpenPurchaseRow = { id: string; paid: string; goods: string };

type PaymentReadRow<T> = {
  /** Payments already recorded for this business on the payment's day. */
  dayTotal: string;
  partyFound: boolean;
  open: T[];
};

/** One settlement row, written to PaymentAllocation and applied to its invoice or purchase. */
type AllocationInput = {
  id: string;
  invoiceId: string | null;
  saleId: string | null;
  purchaseId: string | null;
  amount: string;
  /** Purchase goods total; the purchase `paid` may not go above it. */
  goods: string | null;
};

type PaymentWriteRow = {
  createdAt: Date;
  invoicesUpdated: number;
  purchasesUpdated: number;
  allocations: number;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * §10: payments are records, never balance overwrites.
   * A customer payment targeted at an invoice settles that invoice only and
   * can never exceed its remaining due; an untargeted payment settles the
   * customer's oldest unpaid invoices first (FIFO), allocations recorded.
   *
   * Supplier payments are the readable journal of what the purchase `paid`
   * column already tracks (the mill is owed the goods amount only).
   *
   * Latency: five database round trips (BEGIN, party lock, one read for the
   * daily cap + party + open documents, one write for the payment, the
   * invoice/purchase `paid` updates, allocations and audit, COMMIT).
   */
  async create(businessId: string, dto: CreatePaymentDto, actorId?: string) {
    assertPositiveMoney(dto.amount, "Payment amount");
    // The column stores 2 decimals. Reject extra places instead of letting
    // Postgres round after the checks ran.
    assertMaxDecimals(dto.amount, 2, "Payment amount");
    const amount = new Prisma.Decimal(dto.amount);
    dto.note = sanitizeOptionalText(dto.note, 300);
    if (dto.type === "CUSTOMER" && !dto.customerId) {
      throw new BadRequestException("Customer payments need customerId");
    }
    if (dto.type === "SUPPLIER" && !dto.supplierId) {
      throw new BadRequestException("Supplier payments need supplierId");
    }
    // Payment.date is a DATE column stored by its UTC calendar day.
    const day = new Date(dto.date).toISOString().slice(0, 10);

    return this.prisma.$transaction(async (tx) => {
      const allocations: AllocationInput[] = [];

      if (dto.type === "CUSTOMER") {
        const customerId = dto.customerId as string;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`custpay:${businessId}:${customerId}`}))`;
        const saleId = dto.saleId ?? null;
        const [read] = await tx.$queryRaw<PaymentReadRow<OpenInvoiceRow>[]>`
          SELECT
            (SELECT COALESCE(SUM("amount"), 0)::text FROM "Payment"
              WHERE "businessId" = ${businessId} AND "date" = ${day}::date) AS "dayTotal",
            EXISTS (SELECT 1 FROM "Customer" WHERE "id" = ${customerId} AND "businessId" = ${businessId}) AS "partyFound",
            COALESCE((
              SELECT json_agg(json_build_object(
                'saleId', s."id", 'date', to_char(s."date", 'YYYY-MM-DD'), 'invoiceId', i."id",
                'total', i."total"::text, 'paid', i."paid"::text
              ) ORDER BY s."date", s."id")
              FROM "Sale" s
              INNER JOIN "Invoice" i ON i."saleId" = s."id" AND i."businessId" = ${businessId}
              WHERE s."businessId" = ${businessId} AND s."customerId" = ${customerId}
                AND CASE WHEN ${saleId}::text IS NULL THEN i."total" > 0 ELSE s."id" = ${saleId}::text END
            ), '[]'::json) AS "open"
        `;
        this.assertDailyPaymentCap(read.dayTotal, amount);
        if (!read.partyFound) throw new BadRequestException("Customer not found");

        if (saleId) {
          // The read is scoped to this customer, so another customer's invoice is "not found".
          const invoice = read.open[0];
          if (!invoice) {
            throw new BadRequestException("Invoice not found for this customer");
          }
          const due = new Prisma.Decimal(invoice.total).minus(invoice.paid);
          if (amount.gt(due)) {
            throw new BadRequestException(
              `Payment (${amount.toFixed(2)}) exceeds the remaining due (${Prisma.Decimal.max(due, 0).toFixed(2)})`,
            );
          }
          allocations.push({
            id: newRecordId(), invoiceId: invoice.invoiceId, saleId, purchaseId: null,
            amount: amount.toFixed(2), goods: null,
          });
        } else {
          // FIFO across the customer's oldest unpaid invoices.
          const invoiceBySaleId = new Map(read.open.map((row) => [row.saleId, row.invoiceId]));
          const { allocations: settled, unallocated } = settleFifo(
            read.open.map((row) => ({ saleId: row.saleId, total: row.total, paidSoFar: row.paid, date: row.date })),
            amount,
          );
          // Same rule as supplier payments: money that settles nothing is
          // rejected, never silently dropped from the cash record.
          if (unallocated > 0) {
            throw new BadRequestException(
              `Payment exceeds the remaining due across open invoices by ${unallocated.toFixed(2)}`,
            );
          }
          for (const a of settled) {
            const invoiceId = invoiceBySaleId.get(a.saleId);
            if (!invoiceId) throw new BadRequestException("Invoice not found for allocation");
            allocations.push({
              id: newRecordId(), invoiceId, saleId: a.saleId, purchaseId: null,
              amount: new Prisma.Decimal(a.amount).toFixed(2), goods: null,
            });
          }
        }
      } else {
        const supplierId = dto.supplierId as string;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`suppay:${businessId}:${supplierId}`}))`;
        // Purchases oldest first; goods total computed in SQL (charges are on us, never owed).
        const [read] = await tx.$queryRaw<PaymentReadRow<OpenPurchaseRow>[]>`
          SELECT
            (SELECT COALESCE(SUM("amount"), 0)::text FROM "Payment"
              WHERE "businessId" = ${businessId} AND "date" = ${day}::date) AS "dayTotal",
            EXISTS (SELECT 1 FROM "Supplier" WHERE "id" = ${supplierId} AND "businessId" = ${businessId}) AS "partyFound",
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', p."id", 'paid', p."paid"::text,
                'goods', COALESCE((
                  SELECT ROUND(SUM(pl."qty" * pl."rate"), 2) FROM "PurchaseLine" pl WHERE pl."purchaseId" = p."id"
                ), 0)::text
              ) ORDER BY p."date", p."createdAt")
              FROM "Purchase" p
              WHERE p."businessId" = ${businessId} AND p."supplierId" = ${supplierId}
            ), '[]'::json) AS "open"
        `;
        this.assertDailyPaymentCap(read.dayTotal, amount);
        if (!read.partyFound) throw new BadRequestException("Supplier not found");
        const goodsById = new Map(read.open.map((row) => [row.id, row.goods]));

        if (dto.purchaseId) {
          const row = read.open.find((r) => r.id === dto.purchaseId);
          if (!row) {
            throw new BadRequestException("Purchase not found for this supplier");
          }
          const goods = new Prisma.Decimal(row.goods);
          const due = Prisma.Decimal.max(goods.minus(row.paid), 0);
          if (amount.gt(due)) {
            throw new BadRequestException(
              `Payment (${amount.toFixed(2)}) exceeds the remaining due (${due.toFixed(2)}) on this purchase`,
            );
          }
          allocations.push({
            id: newRecordId(), invoiceId: null, saleId: null, purchaseId: row.id,
            amount: amount.toFixed(2), goods: row.goods,
          });
        } else {
          // FIFO across the supplier's oldest unpaid purchases (goods − paid).
          const settlement = settleSupplierFifo(
            read.open.map((row) => ({ purchaseId: row.id, goodsTotal: row.goods, paid: row.paid })),
            amount,
          );
          if (settlement.unallocated > 0) {
            throw new BadRequestException(
              `Supplier payment exceeds the remaining payable by ${settlement.unallocated.toFixed(2)}`,
            );
          }
          for (const allocation of settlement.allocations) {
            const goods = goodsById.get(allocation.purchaseId);
            if (goods === undefined) throw new BadRequestException("Purchase not found for this supplier");
            allocations.push({
              id: newRecordId(), invoiceId: null, saleId: null, purchaseId: allocation.purchaseId,
              amount: new Prisma.Decimal(allocation.amount).toFixed(2), goods,
            });
          }
        }
      }

      const paymentId = newRecordId();
      const customerId = dto.type === "CUSTOMER" ? dto.customerId ?? null : null;
      const supplierId = dto.type === "SUPPLIER" ? dto.supplierId ?? null : null;
      const saleId = dto.type === "CUSTOMER" ? dto.saleId ?? null : null;
      const purchaseId = dto.type === "SUPPLIER" ? dto.purchaseId ?? null : null;
      const method = dto.method ?? "CASH";
      const auditMeta = JSON.stringify({ type: dto.type, amount: dto.amount });

      // One statement: the payment row, every `paid` increase (each guarded so it can
      // never pass the invoice total or purchase goods total), the allocations and the audit row.
      const [written] = await tx.$queryRaw<PaymentWriteRow[]>`
        WITH new_payment AS (
          INSERT INTO "Payment" ("id", "businessId", "date", "type", "customerId", "supplierId",
                                 "amount", "method", "saleId", "purchaseId", "note")
          VALUES (${paymentId}, ${businessId}, ${day}::date, ${dto.type}::"PaymentType", ${customerId},
                  ${supplierId}, ${amount.toFixed(2)}::numeric, ${method}::"PaymentMethod", ${saleId},
                  ${purchaseId}, ${dto.note ?? null})
          RETURNING "createdAt"
        ),
        alloc AS (
          SELECT * FROM jsonb_to_recordset(${JSON.stringify(allocations)}::jsonb) AS a(
            "id" text, "invoiceId" text, "saleId" text, "purchaseId" text, "amount" numeric, "goods" numeric
          )
        ),
        invoice_update AS (
          UPDATE "Invoice" i SET "paid" = i."paid" + a."amount"
          FROM alloc a
          WHERE a."invoiceId" IS NOT NULL AND i."id" = a."invoiceId"
            AND i."businessId" = ${businessId} AND i."paid" + a."amount" <= i."total"
          RETURNING i."id"
        ),
        purchase_update AS (
          UPDATE "Purchase" p SET "paid" = p."paid" + a."amount"
          FROM alloc a
          WHERE a."purchaseId" IS NOT NULL AND p."id" = a."purchaseId"
            AND p."businessId" = ${businessId} AND p."paid" + a."amount" <= a."goods"
          RETURNING p."id"
        ),
        new_allocation AS (
          INSERT INTO "PaymentAllocation" ("id", "businessId", "paymentId", "saleId", "purchaseId", "amount")
          SELECT a."id", ${businessId}, ${paymentId}, a."saleId", a."purchaseId", a."amount"
          FROM alloc a
          RETURNING "id"
        ),
        new_audit AS (
          INSERT INTO "AuditLog" ("id", "businessId", "actorId", "action", "entityType", "entityId", "metadata")
          VALUES (${newRecordId()}, ${businessId}, ${actorId ?? null}, 'payment.created', 'payment',
                  ${paymentId}, ${auditMeta}::jsonb)
          RETURNING "id"
        )
        SELECT (SELECT "createdAt" FROM new_payment) AS "createdAt",
               (SELECT COUNT(*)::int FROM invoice_update) AS "invoicesUpdated",
               (SELECT COUNT(*)::int FROM purchase_update) AS "purchasesUpdated",
               (SELECT COUNT(*)::int FROM new_allocation) AS "allocations"
      `;
      const invoiceAllocations = allocations.filter((a) => a.invoiceId).length;
      const purchaseAllocations = allocations.filter((a) => a.purchaseId).length;
      // A guarded update that matched no row means the due changed or the row is gone.
      // Throwing here rolls the whole transaction back, payment row included.
      if (written.invoicesUpdated !== invoiceAllocations) {
        throw new BadRequestException(
          "Payment exceeds the remaining due on this invoice or the invoice was not found",
        );
      }
      if (written.purchasesUpdated !== purchaseAllocations) {
        throw new BadRequestException("Supplier payment would exceed the purchase goods total");
      }

      return {
        id: paymentId,
        businessId,
        date: new Date(day),
        type: dto.type,
        customerId,
        supplierId,
        amount,
        method,
        saleId,
        purchaseId,
        note: dto.note ?? null,
        createdAt: written.createdAt,
      };
    });
  }

  private assertDailyPaymentCap(dayTotal: string, amount: Prisma.Decimal) {
    if (new Prisma.Decimal(dayTotal).plus(amount).gt(LIMITS.MAX_DAILY_PAYMENT_TOTAL)) {
      throw new BadRequestException(
        `Daily payment limit of ${LIMITS.MAX_DAILY_PAYMENT_TOTAL} exceeded for this business`,
      );
    }
  }

  async list(
    businessId: string,
    skip: number,
    take: number,
    type?: "customer" | "supplier",
  ) {
    const where = this.baseWhere(businessId, type);
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        relationLoadStrategy: "join",
        where,
        skip,
        take,
        include: listInclude,
        orderBy: listOrder,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return [items, total] as const;
  }

  /** Bulk fetch for /ledger/transactions — one findMany, no count. */
  listAll(businessId: string, take: number) {
    return this.prisma.payment.findMany({
      relationLoadStrategy: "join",
      where: this.baseWhere(businessId),
      include: listInclude,
      orderBy: listOrder,
      take,
    });
  }

  private baseWhere(businessId: string, type?: "customer" | "supplier") {
    return {
      businessId,
      ...(type
        ? { type: type === "customer" ? ("CUSTOMER" as const) : ("SUPPLIER" as const) }
        : {}),
    };
  }

  async byId(businessId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, businessId },
      include: { allocations: true, customer: true, supplier: true },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    return payment;
  }
}
