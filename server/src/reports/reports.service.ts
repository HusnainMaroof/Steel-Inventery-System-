import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { computeProfit, SaleForProfit } from "../domain/profit";
import { landedCostPerUnit, saleGrandTotal } from "../domain/money";

export type ReportMode = "month" | "year" | "range";

export interface ProfitReportInput {
  mode: ReportMode;
  year: number;
  month?: number;
  from?: string;
  to?: string;
  productId?: string;
}

interface Period {
  from: Date;
  to: Date;
  label: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async profit(businessId: string, input: ProfitReportInput) {
    const period = this.periodOf(input);
    const productId = input.productId;

    // ---- transactions in period (scoped to the product when given) ----
    const purchases = await this.prisma.purchase.findMany({
      where: {
        businessId,
        date: { gte: period.from, lte: period.to },
        ...(productId ? { lines: { some: { productId } } } : {}),
      },
      include: {
        lines: {
          where: productId ? { productId } : undefined,
          include: { product: { select: { id: true, name: true, unit: true } } },
        },
      },
      orderBy: { date: "asc" },
    });

    const sales = await this.prisma.sale.findMany({
      where: {
        businessId,
        date: { gte: period.from, lte: period.to },
        ...(productId ? { lines: { some: { productId } } } : {}),
      },
      include: {
        lines: {
          where: productId ? { productId } : undefined,
          include: { product: { select: { id: true, name: true, unit: true } } },
        },
      },
      orderBy: { date: "asc" },
    });

    const expenses = await this.prisma.expense.findMany({
      where: {
        businessId,
        date: { gte: period.from, lte: period.to },
        // shop-wide expenses belong to the All Products view only
        ...(productId ? { productId } : {}),
      },
    });

    const productIdsInSales = [
      ...new Set(sales.flatMap((s) => s.lines.map((l) => l.productId))),
    ];
    const purchaseIdsFromLines = [
      ...new Set(
        sales.flatMap((s) =>
          s.lines.map((l) => l.purchaseId).filter((id): id is string => Boolean(id)),
        ),
      ),
    ];
    const costPurchases = await this.prisma.purchase.findMany({
      where: {
        businessId,
        date: { lte: period.to },
        ...(productId
          ? { lines: { some: { productId } } }
          : productIdsInSales.length
            ? {
                OR: [
                  { id: { in: purchaseIdsFromLines } },
                  { lines: { some: { productId: { in: productIdsInSales } } } },
                ],
              }
            : {}),
      },
      include: { lines: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    // ---- landed cost per unit keyed by source purchase + product ----
    const unitCostByPurchaseProduct = new Map<string, number>();
    const weightedByProduct = new Map<string, { qty: number; cost: number }>();
    for (const p of costPurchases) {
      const goods = p.lines.reduce((sum, l) => sum + Number(l.qty) * Number(l.rate), 0);
      if (goods <= 0) continue;
      const charges =
        Number(p.transport) + Number(p.loading) + Number(p.labour) + Number(p.otherCost);
      for (const line of p.lines) {
        const lineGoods = Number(line.qty) * Number(line.rate);
        const lineCharges = charges * (lineGoods / goods);
        const key = `${p.id}:${line.productId}`;
        const unitCost = landedCostPerUnit({
            qty: Number(line.qty),
            rate: Number(line.rate),
            purchaseCharges: lineCharges,
          });
        const existing = unitCostByPurchaseProduct.get(key);
        if (existing == null) {
          unitCostByPurchaseProduct.set(key, unitCost);
        } else {
          const sameProduct = p.lines.filter((candidate) => candidate.productId === line.productId);
          const totalQty = sameProduct.reduce((sum, candidate) => sum + Number(candidate.qty), 0);
          const totalCost = sameProduct.reduce((sum, candidate) => {
            const candidateGoods = Number(candidate.qty) * Number(candidate.rate);
            const candidateCharges = charges * (candidateGoods / goods);
            return sum + candidateGoods + candidateCharges;
          }, 0);
          unitCostByPurchaseProduct.set(key, totalQty > 0 ? totalCost / totalQty : existing);
        }
        const weighted = weightedByProduct.get(line.productId) ?? { qty: 0, cost: 0 };
        weighted.qty += Number(line.qty);
        weighted.cost += Number(line.qty) * unitCost;
        weightedByProduct.set(line.productId, weighted);
      }
    }

    // ---- P&L ----
    const salesForProfit: SaleForProfit[] = sales.map((s) => ({
      saleId: s.id,
      lines: s.lines.map((l) => ({
        productId: l.productId,
        qty: Number(l.qty),
        rate: Number(l.rate),
        unitCost:
          l.purchaseId
            ? unitCostByPurchaseProduct.get(`${l.purchaseId}:${l.productId}`) ?? 0
            : (() => {
                const weighted = weightedByProduct.get(l.productId);
                return weighted && weighted.qty > 0 ? weighted.cost / weighted.qty : 0;
              })(),
      })),
      discountPct: Number(s.discountPct),
      taxPct: Number(s.taxPct),
      loading: Number(s.loadingCharges),
      transport: Number(s.transportCharges),
      labour: Number(s.labourCharges),
    }));

    const profit = computeProfit(
      salesForProfit,
      expenses.map((e) => ({ productId: e.productId ?? undefined, amount: Number(e.amount) })),
      { productId },
    );

    // ---- stock flow (per product, own unit) from the inventory ledger ----
    const products = await this.prisma.product.findMany({
      where: { businessId, ...(productId ? { id: productId } : {}) },
      select: { id: true, name: true, unit: true },
    });
    const productFilter = productId
      ? Prisma.sql`AND "productId" = ${productId}`
      : Prisma.empty;
    const [openingRows, closingRows] = await Promise.all([
      this.prisma.$queryRaw<{ productId: string; qty: string }[]>`
        SELECT "productId", COALESCE(SUM(qty), 0)::text AS qty
        FROM "InventoryTransaction"
        WHERE "businessId" = ${businessId}
          AND date < ${period.from}
          ${productFilter}
        GROUP BY "productId"
      `,
      this.prisma.$queryRaw<{ productId: string; qty: string }[]>`
        SELECT "productId", COALESCE(SUM(qty), 0)::text AS qty
        FROM "InventoryTransaction"
        WHERE "businessId" = ${businessId}
          AND date <= ${period.to}
          ${productFilter}
        GROUP BY "productId"
      `,
    ]);
    const openingBy = new Map(openingRows.map((r) => [r.productId, Number(r.qty)]));
    const closingBy = new Map(closingRows.map((r) => [r.productId, Number(r.qty)]));
    const stock = products.map((p) => ({
      productId: p.id,
      productName: p.name,
      unit: p.unit,
      openingQty: openingBy.get(p.id) ?? 0,
      remainingQty: closingBy.get(p.id) ?? 0,
    }));

    // ---- dues (balances are derived, never stored — §27) ----
    const [invoiceTotals, invoicePaid, supplierDueRows] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { businessId },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { businessId },
        _sum: { paid: true },
      }),
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
    ]);
    const customerDue = Math.max(
      0,
      Number(invoiceTotals._sum.total ?? 0) - Number(invoicePaid._sum.paid ?? 0),
    );
    const supplierDue = Number(supplierDueRows[0]?.due ?? 0);

    // ---- cash ----
    const [customerCash, supplierCash] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          businessId,
          type: "CUSTOMER",
          date: { gte: period.from, lte: period.to },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          businessId,
          type: "SUPPLIER",
          date: { gte: period.from, lte: period.to },
        },
        _sum: { amount: true },
      }),
    ]);
    const cashReceived = Number(customerCash._sum.amount ?? 0);
    const cashPaid = Number(supplierCash._sum.amount ?? 0);
    const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const cashInHand = cashReceived - cashPaid - expensesTotal;

    // ---- business value = remaining stock valuation + customer due + cash ----
    const [lineWeights, chargeTotals] = await Promise.all([
      this.prisma.$queryRaw<{ productId: string; qty: string; goods: string }[]>`
        SELECT pl."productId",
          COALESCE(SUM(pl.qty), 0)::text AS qty,
          COALESCE(SUM(pl.qty * pl.rate), 0)::text AS goods
        FROM "PurchaseLine" pl
        INNER JOIN "Purchase" p ON p.id = pl."purchaseId"
        WHERE p."businessId" = ${businessId}
        GROUP BY pl."productId"
      `,
      this.prisma.$queryRaw<{ totalCharges: string; totalGoods: string }[]>`
        SELECT
          COALESCE(SUM(p.transport + p.loading + p.labour + p."otherCost"), 0)::text AS "totalCharges",
          COALESCE((
            SELECT SUM(pl.qty * pl.rate)
            FROM "PurchaseLine" pl
            INNER JOIN "Purchase" p2 ON p2.id = pl."purchaseId"
            WHERE p2."businessId" = ${businessId}
          ), 0)::text AS "totalGoods"
        FROM "Purchase" p
        WHERE p."businessId" = ${businessId}
      `,
    ]);
    const weight = new Map(
      lineWeights.map((row) => [
        row.productId,
        { qty: Number(row.qty), value: Number(row.goods) },
      ]),
    );
    const totalCharges = Number(chargeTotals[0]?.totalCharges ?? 0);
    const totalGoods = Number(chargeTotals[0]?.totalGoods ?? 0);
    const remainingValuation = products.reduce((sum, p) => {
      const w = weight.get(p.id);
      if (!w || w.qty <= 0) return sum;
      const avgLanded = (w.value + totalCharges * (w.value / (totalGoods || 1))) / w.qty;
      return sum + (closingBy.get(p.id) ?? 0) * avgLanded;
    }, 0);
    const businessValue = remainingValuation + customerDue + cashInHand;

    return {
      period: period.label,
      productScope: productId ?? "ALL_PRODUCTS",
      profit,
      stock,
      dues: { customerDue, supplierDue },
      cash: { cashReceived, cashPaid, expenses: expensesTotal, cashInHand },
      remainingValuation,
      businessValue,
      salesGrandTotals: sales.map((s) =>
        saleGrandTotal(
          s.lines.map((l) => ({ qty: Number(l.qty), rate: Number(l.rate) })),
          {
            discountPct: Number(s.discountPct),
            taxPct: Number(s.taxPct),
            loading: Number(s.loadingCharges),
            transport: Number(s.transportCharges),
            labour: Number(s.labourCharges),
          },
        ).grandTotal,
      ),
    };
  }

  private periodOf(input: ProfitReportInput): Period {
    const now = new Date();
    if (input.mode === "range" && (input.from || input.to)) {
      const from = input.from ? new Date(input.from) : new Date("2000-01-01");
      const to = input.to ? new Date(input.to) : now;
      const days = (to.getTime() - from.getTime()) / 86_400_000;
      if (days > 731) {
        throw new BadRequestException("Report date range cannot exceed two years");
      }
      return {
        from,
        to,
        label: `${input.from ?? "start"} → ${input.to ?? "today"}`,
      };
    }
    if (input.mode === "year") {
      return {
        from: new Date(`${input.year}-01-01`),
        to: new Date(`${input.year}-12-31`),
        label: String(input.year),
      };
    }
    const month = input.month ?? now.getMonth() + 1;
    return {
      from: new Date(`${input.year}-${String(month).padStart(2, "0")}-01`),
      to: new Date(input.year, month, 0),
      label: `${input.year}-${String(month).padStart(2, "0")}`,
    };
  }
}
