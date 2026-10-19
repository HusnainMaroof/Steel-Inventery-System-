import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { attributedLineRevenue, computeProfit, SaleForProfit } from "../domain/profit";
import { landedCostPerUnit, roundMoneyDecimal, saleGrandTotalDecimal } from "../domain/money";
import { businessValue as businessValueOf, cashInHand as cashInHandOf } from "../domain/report-money";

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

    // Prisma query builders are lazy, so await independent queries together below.
    // Cost purchases depend on sales and run in phase 2.
    const salesPromise = this.prisma.sale.findMany({
      relationLoadStrategy: "join",
      where: {
        businessId,
        date: { gte: period.from, lte: period.to },
        ...(productId ? { lines: { some: { productId } } } : {}),
      },
      include: {
        // all lines of the sale: a product's share of discount, tax and flat
        // charges is its share of the whole subtotal (scoped in computeProfit)
        lines: true,
      },
      orderBy: { date: "asc" },
    });

    const expensesPromise = this.prisma.expense.findMany({
      where: {
        businessId,
        date: { gte: period.from, lte: period.to },
        // shop-wide expenses belong to the All Products view only
        ...(productId ? { productId } : {}),
      },
    });

    const productFilter = productId
      ? Prisma.sql`AND "productId" = ${productId}`
      : Prisma.empty;
    const productsPromise = this.prisma.product.findMany({
      where: { businessId, ...(productId ? { id: productId } : {}) },
      select: { id: true, name: true, unit: true },
    });
    const stockRowsPromise = this.prisma.$queryRaw<
      { productId: string; opening: string; closing: string }[]
    >`
      SELECT "productId",
        COALESCE(SUM(qty) FILTER (WHERE date < ${period.from}), 0)::text AS opening,
        COALESCE(SUM(qty) FILTER (WHERE date <= ${period.to}), 0)::text AS closing
      FROM "InventoryTransaction"
      WHERE "businessId" = ${businessId}
        AND date <= ${period.to}
        ${productFilter}
      GROUP BY "productId"
    `;
    // Dues are the balance at the end of the selected dates.
    // A bill or payment after that date does not count.
    // A chosen product gets only its share of each open bill.
    const customerDueRowsPromise = this.prisma.$queryRaw<{ due: string }[]>`
      WITH paid AS (
        SELECT pa."saleId" AS sale_id, COALESCE(SUM(pa.amount), 0) AS amount
        FROM "PaymentAllocation" pa
        INNER JOIN "Payment" pay ON pay."id" = pa."paymentId"
        WHERE pay."businessId" = ${businessId}
          AND pay."date" <= ${period.to}
          AND pa."saleId" IS NOT NULL
        GROUP BY pa."saleId"
      ),
      goods AS (
        SELECT sl."saleId" AS sale_id,
          COALESCE(SUM(sl."qty" * sl."rate"), 0) AS all_goods,
          COALESCE(SUM(sl."qty" * sl."rate") FILTER (WHERE sl."productId" = ${productId ?? ""}), 0) AS product_goods
        FROM "SaleLine" sl
        INNER JOIN "Sale" s ON s."id" = sl."saleId"
        WHERE s."businessId" = ${businessId}
          AND s."date" <= ${period.to}
        GROUP BY sl."saleId"
      )
      SELECT COALESCE(SUM(
        GREATEST(0, i."total" - COALESCE(paid.amount, 0))
        * CASE
            WHEN ${productId ?? null}::text IS NULL THEN 1
            WHEN COALESCE(goods.all_goods, 0) <= 0 THEN 0
            ELSE COALESCE(goods.product_goods, 0) / goods.all_goods
          END
      ), 0)::text AS due
      FROM "Invoice" i
      INNER JOIN "Sale" s ON s."id" = i."saleId"
      LEFT JOIN paid ON paid.sale_id = s."id"
      LEFT JOIN goods ON goods.sale_id = s."id"
      WHERE i."businessId" = ${businessId}
        AND s."date" <= ${period.to}
    `;
    const supplierDueRowsPromise = this.prisma.$queryRaw<{ due: string }[]>`
      WITH paid AS (
        SELECT pa."purchaseId" AS purchase_id, COALESCE(SUM(pa.amount), 0) AS amount
        FROM "PaymentAllocation" pa
        INNER JOIN "Payment" pay ON pay."id" = pa."paymentId"
        WHERE pay."businessId" = ${businessId}
          AND pay."date" <= ${period.to}
          AND pa."purchaseId" IS NOT NULL
        GROUP BY pa."purchaseId"
      ),
      goods AS (
        SELECT pl."purchaseId" AS purchase_id,
          COALESCE(ROUND(SUM(pl."qty" * pl."rate"), 2), 0) AS all_goods,
          COALESCE(SUM(pl."qty" * pl."rate") FILTER (WHERE pl."productId" = ${productId ?? ""}), 0) AS product_goods
        FROM "PurchaseLine" pl
        INNER JOIN "Purchase" p ON p."id" = pl."purchaseId"
        WHERE p."businessId" = ${businessId}
          AND p."date" <= ${period.to}
        GROUP BY pl."purchaseId"
      )
      SELECT COALESCE(SUM(
        GREATEST(0, COALESCE(goods.all_goods, 0) - COALESCE(paid.amount, 0))
        * CASE
            WHEN ${productId ?? null}::text IS NULL THEN 1
            WHEN COALESCE(goods.all_goods, 0) <= 0 THEN 0
            ELSE COALESCE(goods.product_goods, 0) / goods.all_goods
          END
      ), 0)::text AS due
      FROM "Purchase" p
      LEFT JOIN paid ON paid.purchase_id = p."id"
      LEFT JOIN goods ON goods.purchase_id = p."id"
      WHERE p."businessId" = ${businessId}
        AND p."date" <= ${period.to}
    `;
    const customerCashPromise = this.prisma.payment.aggregate({
      where: {
        businessId,
        type: "CUSTOMER",
        date: { gte: period.from, lte: period.to },
      },
      _sum: { amount: true },
    });
    const supplierCashPromise = this.prisma.payment.aggregate({
      where: {
        businessId,
        type: "SUPPLIER",
        date: { gte: period.from, lte: period.to },
      },
      _sum: { amount: true },
    });
    const lineWeightsPromise = this.prisma.$queryRaw<{ productId: string; qty: string; goods: string }[]>`
      SELECT pl."productId",
        COALESCE(SUM(pl.qty), 0)::text AS qty,
        COALESCE(SUM(pl.qty * pl.rate), 0)::text AS goods
      FROM "PurchaseLine" pl
      INNER JOIN "Purchase" p ON p.id = pl."purchaseId"
      WHERE p."businessId" = ${businessId}
      GROUP BY pl."productId"
    `;
    const chargeTotalsPromise = this.prisma.$queryRaw<{ totalCharges: string; totalGoods: string }[]>`
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
    `;

    const [
      sales,
      expenses,
      products,
      stockRows,
      customerDueRows,
      supplierDueRows,
      customerCash,
      supplierCash,
      lineWeights,
      chargeTotals,
    ] = await Promise.all([
      salesPromise,
      expensesPromise,
      productsPromise,
      stockRowsPromise,
      customerDueRowsPromise,
      supplierDueRowsPromise,
      customerCashPromise,
      supplierCashPromise,
      lineWeightsPromise,
      chargeTotalsPromise,
    ]);

    // cost lookups only need the scoped product's lines
    const scopedLines = (s: { lines: { productId: string; purchaseId?: string | null }[] }) =>
      s.lines.filter((l) => !productId || l.productId === productId);
    const productIdsInSales = [
      ...new Set(sales.flatMap((s) => scopedLines(s).map((l) => l.productId))),
    ];
    const purchaseIdsFromLines = [
      ...new Set(
        sales
          .flatMap((s) => scopedLines(s).map((l) => l.purchaseId).filter((id): id is string => Boolean(id))),
      ),
    ];
    const costPurchasesPromise: Promise<
      Prisma.PurchaseGetPayload<{ include: { lines: true } }>[]
    > =
      sales.length === 0
        ? Promise.resolve([])
        : this.prisma.purchase.findMany({
            relationLoadStrategy: "join",
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

    const costPurchases = await costPurchasesPromise;

    // ---- landed cost per unit keyed by source purchase + product ----
    // Unit cost stays exact Decimal here: never rounded before multiplying by qty.
    const unitCostByPurchaseProduct = new Map<string, Prisma.Decimal>();
    const weightedByProduct = new Map<string, { qty: Prisma.Decimal; cost: Prisma.Decimal }>();
    for (const p of costPurchases) {
      const goods = p.lines.reduce(
        (sum, l) => sum.plus(new Prisma.Decimal(l.qty).times(l.rate)),
        new Prisma.Decimal(0),
      );
      if (goods.lte(0)) continue;
      const charges = new Prisma.Decimal(p.transport)
        .plus(p.loading)
        .plus(p.labour)
        .plus(p.otherCost);
      for (const line of p.lines) {
        const lineGoods = new Prisma.Decimal(line.qty).times(line.rate);
        const lineCharges = charges.times(lineGoods).div(goods);
        const key = `${p.id}:${line.productId}`;
        const unitCost = landedCostPerUnit({
          qty: line.qty,
          rate: line.rate,
          purchaseCharges: lineCharges,
        });
        const existing = unitCostByPurchaseProduct.get(key);
        if (existing == null) {
          unitCostByPurchaseProduct.set(key, unitCost);
        } else {
          const sameProduct = p.lines.filter((candidate) => candidate.productId === line.productId);
          const totalQty = sameProduct.reduce(
            (sum, candidate) => sum.plus(candidate.qty),
            new Prisma.Decimal(0),
          );
          const totalCost = sameProduct.reduce((sum, candidate) => {
            const candidateGoods = new Prisma.Decimal(candidate.qty).times(candidate.rate);
            const candidateCharges = charges.times(candidateGoods).div(goods);
            return sum.plus(candidateGoods).plus(candidateCharges);
          }, new Prisma.Decimal(0));
          unitCostByPurchaseProduct.set(
            key,
            totalQty.gt(0) ? totalCost.div(totalQty) : existing,
          );
        }
        const weighted = weightedByProduct.get(line.productId) ?? {
          qty: new Prisma.Decimal(0),
          cost: new Prisma.Decimal(0),
        };
        weighted.qty = weighted.qty.plus(line.qty);
        weighted.cost = weighted.cost.plus(new Prisma.Decimal(line.qty).times(unitCost));
        weightedByProduct.set(line.productId, weighted);
      }
    }

    // ---- P&L ----
    const salesForProfit: SaleForProfit[] = sales.map((s) => ({
      saleId: s.id,
      lines: s.lines.map((l) => ({
        productId: l.productId,
        qty: l.qty,
        rate: l.rate,
        unitCost:
          l.purchaseId
            ? unitCostByPurchaseProduct.get(`${l.purchaseId}:${l.productId}`) ?? new Prisma.Decimal(0)
            : (() => {
                const weighted = weightedByProduct.get(l.productId);
                return weighted && weighted.qty.gt(0)
                  ? weighted.cost.div(weighted.qty)
                  : new Prisma.Decimal(0);
              })(),
      })),
      discountPct: s.discountPct,
      taxPct: s.taxPct,
      loading: s.loadingCharges,
      transport: s.transportCharges,
      labour: s.labourCharges,
    }));

    const profit = computeProfit(
      salesForProfit,
      expenses.map((e) => ({ productId: e.productId ?? undefined, amount: e.amount })),
      { productId },
    );

    // ---- stock flow (per product, own unit) from the inventory ledger ----
    const openingBy = new Map(stockRows.map((r) => [r.productId, Number(r.opening)]));
    const closingBy = new Map(stockRows.map((r) => [r.productId, Number(r.closing)]));
    const closingExactBy = new Map(stockRows.map((r) => [r.productId, r.closing]));
    const stock = products.map((p) => ({
      productId: p.id,
      productName: p.name,
      unit: p.unit,
      openingQty: openingBy.get(p.id) ?? 0,
      remainingQty: closingBy.get(p.id) ?? 0,
    }));

    // ---- dues (balances are derived, never stored — §27) ----
    const customerDue = roundMoneyDecimal(customerDueRows[0]?.due ?? 0);
    const supplierDue = roundMoneyDecimal(supplierDueRows[0]?.due ?? 0);

    // ---- cash (Decimal end to end, rounded at the money boundary) ----
    const cashReceived = roundMoneyDecimal(customerCash._sum.amount ?? 0);
    const cashPaid = roundMoneyDecimal(supplierCash._sum.amount ?? 0);
    const expensesTotal = roundMoneyDecimal(
      expenses.reduce((s, e) => s.plus(e.amount), new Prisma.Decimal(0)),
    );
    const cashInHand = cashInHandOf({
      received: cashReceived,
      paid: cashPaid,
      expenses: expensesTotal,
    });

    // ---- business value = remaining stock valuation + customer due + cash ----
    const weight = new Map(
      lineWeights.map((row) => [
        row.productId,
        { qty: new Prisma.Decimal(row.qty), value: new Prisma.Decimal(row.goods) },
      ]),
    );
    const totalCharges = new Prisma.Decimal(chargeTotals[0]?.totalCharges ?? 0);
    const totalGoods = new Prisma.Decimal(chargeTotals[0]?.totalGoods ?? 0);
    const remainingValuationExact = products.reduce((sum, p) => {
      const w = weight.get(p.id);
      if (!w || w.qty.lte(0)) return sum;
      // avg landed = (goods + charges × goods share) / qty, kept exact until the final rounding
      const share = totalGoods.gt(0) ? w.value.div(totalGoods) : new Prisma.Decimal(0);
      const avgLanded = w.value.plus(totalCharges.times(share)).div(w.qty);
      return sum.plus(new Prisma.Decimal(closingExactBy.get(p.id) ?? 0).times(avgLanded));
    }, new Prisma.Decimal(0));
    const remainingValuation = roundMoneyDecimal(remainingValuationExact);
    const businessValue = businessValueOf({
      remainingValuation,
      customerDue,
      cashInHand,
    });

    return {
      period: period.label,
      productScope: productId ?? "ALL_PRODUCTS",
      profit,
      stock,
      dues: { customerDue: customerDue.toNumber(), supplierDue: supplierDue.toNumber() },
      cash: {
        cashReceived: cashReceived.toNumber(),
        cashPaid: cashPaid.toNumber(),
        expenses: expensesTotal.toNumber(),
        cashInHand: cashInHand.toNumber(),
      },
      remainingValuation: remainingValuation.toNumber(),
      businessValue: businessValue.toNumber(),
      // scoped: the product's attributed share of each sale, so the per-product
      // figures add up to the invoice grand total
      salesGrandTotals: salesForProfit.map((s) =>
        productId
          ? roundMoneyDecimal(
              s.lines
                .filter((l) => l.productId === productId)
                .reduce((sum, l) => sum.plus(attributedLineRevenue(s, l)), new Prisma.Decimal(0)),
            ).toNumber()
          : saleGrandTotalDecimal(
              s.lines.map((l) => ({ qty: l.qty, rate: l.rate })),
              {
                discountPct: s.discountPct,
                taxPct: s.taxPct,
                loading: s.loading,
                transport: s.transport,
                labour: s.labour,
              },
            ).grandTotal.toNumber(),
      ),
    };
  }

  private periodOf(input: ProfitReportInput): Period {
    const now = new Date();
    if (input.mode === "range" && (input.from || input.to)) {
      const from = input.from ? new Date(input.from) : new Date("2000-01-01");
      const to = input.to ? new Date(input.to) : now;
      const days = (to.getTime() - from.getTime()) / 86_400_000;
      if (days > 366) {
        throw new BadRequestException("You can only check data for one year");
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
      from: new Date(Date.UTC(input.year, month - 1, 1)),
      to: new Date(Date.UTC(input.year, month, 0)),
      label: `${input.year}-${String(month).padStart(2, "0")}`,
    };
  }
}
