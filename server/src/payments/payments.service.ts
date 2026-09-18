import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { AuditService } from "../common/audit/audit.service";
import {
  incrementInvoicePaidOrThrow,
  incrementPurchasePaid,
} from "../common/payments/invoice-atomic";
import { assertPositiveMoney, LIMITS } from "../common/security/limits";
import { sanitizeOptionalText } from "../common/security/sanitize-text";
import { PrismaService } from "../prisma/prisma.service";
import { openPurchasesForSupplier } from "../common/prisma/query-helpers";
import { settleFifo } from "../domain/payment-settlement";
import { CreatePaymentDto } from "./dto/create-payment.dto";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * §10 — payments are records, never balance overwrites.
   * A customer payment targeted at an invoice settles that invoice only and
   * can never exceed its remaining due; an untargeted payment settles the
   * customer's oldest unpaid invoices first (FIFO), allocations recorded.
   *
   * Supplier payments are the readable journal of what the purchase `paid`
   * column already tracks (the mill is owed the goods amount only).
   */
  private async assertDailyPaymentCap(
    tx: Prisma.TransactionClient,
    businessId: string,
    date: string,
    amount: number,
  ) {
    const day = new Date(date);
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);
    const agg = await tx.payment.aggregate({
      where: { businessId, date: { gte: start, lte: end } },
      _sum: { amount: true },
    });
    const today = Number(agg._sum.amount ?? 0);
    if (today + amount > LIMITS.MAX_DAILY_PAYMENT_TOTAL + 0.005) {
      throw new BadRequestException(
        `Daily payment limit of ${LIMITS.MAX_DAILY_PAYMENT_TOTAL} exceeded for this business`,
      );
    }
  }

  async create(businessId: string, dto: CreatePaymentDto, actorId?: string) {
    assertPositiveMoney(dto.amount, "Payment amount");
    dto.note = sanitizeOptionalText(dto.note, 300);

    return this.prisma.$transaction(async (tx) => {
      await this.assertDailyPaymentCap(tx, businessId, dto.date, dto.amount);

      if (dto.type === "CUSTOMER") {
        if (dto.customerId) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`custpay:${businessId}:${dto.customerId}`}))`;
        }
        if (!dto.customerId) {
          throw new BadRequestException("Customer payments need customerId");
        }
        const customer = await tx.customer.findFirst({
          where: { id: dto.customerId, businessId },
          select: { id: true },
        });
        if (!customer) throw new BadRequestException("Customer not found");

        const payment = await tx.payment.create({
          data: {
            businessId,
            date: new Date(dto.date),
            type: "CUSTOMER",
            customerId: dto.customerId,
            amount: dto.amount,
            method: dto.method ?? "CASH",
            saleId: dto.saleId,
            note: dto.note,
          },
        });

        if (dto.saleId) {
          const invoice = await tx.invoice.findFirst({
            where: { businessId, saleId: dto.saleId },
          });
          if (!invoice) throw new BadRequestException("Invoice not found");
          const due = Number(invoice.total) - Number(invoice.paid);
          if (dto.amount > due + 0.005) {
            throw new BadRequestException(
              `Payment (${dto.amount}) exceeds the remaining due (${Math.max(0, due)})`,
            );
          }
          await incrementInvoicePaidOrThrow(tx, businessId, invoice.id, dto.amount);
          await tx.paymentAllocation.create({
            data: {
              businessId,
              paymentId: payment.id,
              saleId: dto.saleId,
              amount: dto.amount,
            },
          });
        } else {
          // FIFO across the customer's oldest unpaid invoices.
          const sales = await tx.sale.findMany({
            where: {
              businessId,
              customerId: dto.customerId,
              invoice: { total: { gt: 0 } },
            },
            select: {
              id: true,
              date: true,
              invoice: { select: { total: true, paid: true } },
            },
            orderBy: { date: "asc" },
          });
          const open = sales
            .filter((s) => s.invoice)
            .map((s) => ({
              saleId: s.id,
              total: Number(s.invoice!.total),
              paidSoFar: Number(s.invoice!.paid),
              date: s.date.toISOString().slice(0, 10),
            }));
          const { allocations } = settleFifo(open, dto.amount);
          if (allocations.length > 0) {
            const invoices = await tx.invoice.findMany({
              where: {
                businessId,
                saleId: { in: allocations.map((a) => a.saleId) },
              },
              select: { id: true, saleId: true },
            });
            const invoiceBySaleId = new Map(invoices.map((row) => [row.saleId, row.id]));
            for (const a of allocations) {
              const invoiceId = invoiceBySaleId.get(a.saleId);
              if (!invoiceId) {
                throw new BadRequestException("Invoice not found for allocation");
              }
              await incrementInvoicePaidOrThrow(tx, businessId, invoiceId, a.amount);
              await tx.paymentAllocation.create({
                data: {
                  businessId,
                  paymentId: payment.id,
                  saleId: a.saleId,
                  amount: a.amount,
                },
              });
            }
          }
        }
        await this.audit.logTx(tx, {
          businessId,
          actorId: actorId ?? null,
          action: "payment.created",
          entityType: "payment",
          entityId: payment.id,
          metadata: { type: "CUSTOMER", amount: dto.amount },
        });
        return payment;
      }

      if (!dto.supplierId) {
        throw new BadRequestException("Supplier payments need supplierId");
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`suppay:${businessId}:${dto.supplierId}`}))`;
      const supplier = await tx.supplier.findFirst({
        where: { id: dto.supplierId, businessId },
        select: { id: true },
      });
      if (!supplier) throw new BadRequestException("Supplier not found");

      const payment = await tx.payment.create({
        data: {
          businessId,
          date: new Date(dto.date),
          type: "SUPPLIER",
          supplierId: dto.supplierId,
          amount: dto.amount,
          method: dto.method ?? "CASH",
          note: dto.note,
        },
      });

      // FIFO across the supplier's oldest unpaid purchases (goods − paid).
      const openPurchases = await openPurchasesForSupplier(
        tx,
        businessId,
        dto.supplierId,
      );
      let left = dto.amount;
      for (const purchase of openPurchases) {
        if (left <= 0.005) break;
        const goods = Number(purchase.goods);
        const due = Math.max(0, goods - Number(purchase.paid));
        const take = Math.min(due, left);
        if (take > 0.005) {
          const ok = await incrementPurchasePaid(
            tx,
            businessId,
            purchase.id,
            take,
            goods,
          );
          if (!ok) {
            throw new BadRequestException(
              "Supplier payment would exceed the purchase goods total",
            );
          }
          left = Math.round((left - take) * 100) / 100;
        }
      }

      await this.audit.logTx(tx, {
        businessId,
        actorId: actorId ?? null,
        action: "payment.created",
        entityType: "payment",
        entityId: payment.id,
        metadata: { type: "SUPPLIER", amount: dto.amount },
      });
      return payment;
    });
  }

  async list(
    businessId: string,
    skip: number,
    take: number,
    type?: "customer" | "supplier",
  ) {
    const where = {
      businessId,
      ...(type
        ? { type: type === "customer" ? ("CUSTOMER" as const) : ("SUPPLIER" as const) }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        include: {
          customer: { select: { id: true, name: true, shop: true } },
          supplier: { select: { id: true, name: true, mill: true } },
          allocations: true,
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      this.prisma.payment.count({ where }),
    ]);
    return [items, total] as const;
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
