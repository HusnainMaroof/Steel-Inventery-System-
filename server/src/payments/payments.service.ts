import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { settleFifo } from "../domain/payment-settlement";
import { CreatePaymentDto } from "./dto/create-payment.dto";

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * §10 — payments are records, never balance overwrites.
   * A customer payment targeted at an invoice settles that invoice only and
   * can never exceed its remaining due; an untargeted payment settles the
   * customer's oldest unpaid invoices first (FIFO), allocations recorded.
   *
   * Supplier payments are the readable journal of what the purchase `paid`
   * column already tracks (the mill is owed the goods amount only).
   */
  async create(businessId: string, dto: CreatePaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.type === "CUSTOMER") {
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
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { paid: Number(invoice.paid) + dto.amount },
          });
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
            include: { invoice: true },
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
          for (const a of allocations) {
            await tx.paymentAllocation.create({
              data: {
                businessId,
                paymentId: payment.id,
                saleId: a.saleId,
                amount: a.amount,
              },
            });
            await tx.invoice.updateMany({
              where: { businessId, saleId: a.saleId },
              data: { paid: { increment: a.amount } },
            });
          }
        }
        return payment;
      }

      // SUPPLIER payment — journal record of money sent to the mill.
      if (!dto.supplierId) {
        throw new BadRequestException("Supplier payments need supplierId");
      }
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
      const openPurchases = await tx.purchase.findMany({
        where: { businessId, supplierId: dto.supplierId },
        include: { lines: true },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      });
      let left = dto.amount;
      for (const purchase of openPurchases) {
        if (left <= 0.005) break;
        const goods = purchase.lines.reduce(
          (sum, l) => sum + Number(l.qty) * Number(l.rate),
          0,
        );
        const due = Math.max(0, goods - Number(purchase.paid));
        const take = Math.min(due, left);
        if (take > 0.005) {
          await tx.purchase.update({
            where: { id: purchase.id },
            data: { paid: { increment: take } },
          });
          left = Math.round((left - take) * 100) / 100;
        }
      }

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
