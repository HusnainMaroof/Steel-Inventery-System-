import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type DashboardSummary = {
  stockQty: number;
  stockValue: number;
  revenue: number;
  customerDue: number;
  supplierDue: number;
  saleCount: number;
  purchaseCount: number;
  paymentCount: number;
  expenseTotal: number;
};

@Injectable()
export class DashboardSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async summarize(businessId: string): Promise<DashboardSummary> {
    const [
      stockAgg,
      invoiceAgg,
      supplierDueRows,
      revenueAgg,
      saleCount,
      purchaseCount,
      paymentCount,
      expenseAgg,
    ] = await Promise.all([
      this.prisma.inventoryTransaction.groupBy({
        by: ["productId"],
        where: { businessId },
        _sum: { qty: true },
      }),
      this.prisma.$queryRaw<{ total: string; paid: string }[]>`
        SELECT COALESCE(SUM("total"), 0)::text AS total,
               COALESCE(SUM("paid"), 0)::text AS paid
        FROM "Invoice"
        WHERE "businessId" = ${businessId}
      `,
      this.prisma.$queryRaw<{ due: string }[]>`
        SELECT COALESCE(SUM(
          GREATEST(
            0,
            COALESCE((
              SELECT SUM(pl."qty" * pl."rate")
              FROM "PurchaseLine" pl
              WHERE pl."purchaseId" = p."id"
            ), 0) - p."paid"
          )
        ), 0)::text AS due
        FROM "Purchase" p
        WHERE p."businessId" = ${businessId}
      `,
      this.prisma.$queryRaw<{ revenue: string }[]>`
        SELECT COALESCE(SUM(i."total"), 0)::text AS revenue
        FROM "Invoice" i
        WHERE i."businessId" = ${businessId}
      `,
      this.prisma.sale.count({ where: { businessId } }),
      this.prisma.purchase.count({ where: { businessId } }),
      this.prisma.payment.count({ where: { businessId } }),
      this.prisma.expense.aggregate({
        where: { businessId },
        _sum: { amount: true },
      }),
    ]);

    const stockQty = stockAgg.reduce((s, r) => s + Number(r._sum.qty ?? 0), 0);
    const invTotal = Number(invoiceAgg[0]?.total ?? 0);
    const invPaid = Number(invoiceAgg[0]?.paid ?? 0);

    return {
      stockQty,
      stockValue: 0,
      revenue: Number(revenueAgg[0]?.revenue ?? 0),
      customerDue: Math.max(0, invTotal - invPaid),
      supplierDue: Number(supplierDueRows[0]?.due ?? 0),
      saleCount,
      purchaseCount,
      paymentCount,
      expenseTotal: Number(expenseAgg._sum.amount ?? 0),
    };
  }
}
