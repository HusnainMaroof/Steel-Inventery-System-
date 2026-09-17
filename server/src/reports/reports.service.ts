import { Injectable } from "@nestjs/common";
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

    // Source purchases may predate the report period. COGS must still use
    // their landed cost instead of silently becoming zero.
    const costPurchases = await this.prisma.purchase.findMany({
      where: { businessId, date: { lte: period.to } },
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
    const allTx = await this.prisma.inventoryTransaction.findMany({
      where: { businessId, ...(productId ? { productId } : {}), date: { lte: period.to } },
      select: { productId: true, qty: true, date: true },
    });
    const openingBy = new Map<string, number>();
    const closingBy = new Map<string, number>();
    for (const t of allTx) {
      const q = Number(t.qty);
      closingBy.set(t.productId, (closingBy.get(t.productId) ?? 0) + q);
      if (t.date < period.from) {
        openingBy.set(t.productId, (openingBy.get(t.productId) ?? 0) + q);
      }
    }
    const stock = products.map((p) => ({
      productId: p.id,
      productName: p.name,
      unit: p.unit,
      openingQty: openingBy.get(p.id) ?? 0,
      remainingQty: closingBy.get(p.id) ?? 0,
    }));

    // ---- dues (balances are derived, never stored — §27) ----
    const [invoiceTotals, invoicePaid, purchasesAll] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { businessId },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { businessId },
        _sum: { paid: true },
      }),
      this.prisma.purchase.findMany({
        where: { businessId },
        select: {
          paid: true,
          lines: { select: { qty: true, rate: true } },
        },
      }),
    ]);
    const customerDue = Math.max(
      0,
      Number(invoiceTotals._sum.total ?? 0) - Number(invoicePaid._sum.paid ?? 0),
    );
    const supplierDue = purchasesAll.reduce((sum, p) => {
      const goods = p.lines.reduce((s, l) => s + Number(l.qty) * Number(l.rate), 0);
      return sum + Math.max(0, goods - Number(p.paid));
    }, 0);

    // ---- cash ----
    const paymentsInRange = await this.prisma.payment.findMany({
      where: { businessId, date: { gte: period.from, lte: period.to } },
    });
    const cashReceived = paymentsInRange
      .filter((p) => p.type === "CUSTOMER")
      .reduce((s, p) => s + Number(p.amount), 0);
    const cashPaid = paymentsInRange
      .filter((p) => p.type === "SUPPLIER")
      .reduce((s, p) => s + Number(p.amount), 0);
    const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const cashInHand = cashReceived - cashPaid - expensesTotal;

    // ---- business value = remaining stock valuation + customer due + cash ----
    const allPurchaseLines = await this.prisma.purchaseLine.findMany({
      where: { purchase: { businessId } },
      select: { productId: true, qty: true, rate: true },
    });
    const purchasesForValuation = await this.prisma.purchase.findMany({
      where: { businessId },
      select: { transport: true, loading: true, labour: true, otherCost: true },
    });
    const weight = new Map<string, { qty: number; value: number }>();
    for (const line of allPurchaseLines) {
      const goods = Number(line.qty) * Number(line.rate);
      const w = weight.get(line.productId) ?? { qty: 0, value: 0 };
      w.qty += Number(line.qty);
      w.value += goods;
      weight.set(line.productId, w);
    }
    // charges counted once per purchase, then spread by goods share
    const totalCharges = purchasesForValuation.reduce(
      (sum, p) =>
        sum +
        Number(p.transport) +
        Number(p.loading) +
        Number(p.labour) +
        Number(p.otherCost),
      0,
    );
    const totalGoods = allPurchaseLines.reduce(
      (sum, l) => sum + Number(l.qty) * Number(l.rate),
      0,
    );
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
      return {
        from: input.from ? new Date(input.from) : new Date("2000-01-01"),
        to: input.to ? new Date(input.to) : now,
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
