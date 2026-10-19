import { Prisma } from "@prisma/client";
import { roundMoneyDecimal, saleGrandTotal } from "./money";

/**
 * Profit engine (§27): the report is computed from transaction records, so
 * it can always answer "why is this number this amount".
 *
 * Revenue attribution: an invoice's flat charges and discount/tax are spread
 * across its lines in proportion to each line's share of the subtotal — the
 * same rule as `saleGrandTotal`, so figures reconcile with invoices.
 *
 * Precision: unit cost stays an exact Decimal (never rounded to paisa before
 * multiplying by quantity). Only the returned money totals are rounded to 2
 * decimals, half-up.
 */
type D = Prisma.Decimal.Value;
const Dec = (v: D) => new Prisma.Decimal(v);

export interface SaleLineForProfit {
  productId: string;
  qty: D;
  rate: D;
  /** Landed cost per unit of this line (from its source purchase), exact. */
  unitCost: D;
}

export interface SaleForProfit {
  saleId: string;
  lines: SaleLineForProfit[];
  discountPct: D;
  taxPct: D;
  loading: D;
  transport: D;
  labour: D;
}

export interface ExpenseForProfit {
  productId?: string; // absent = whole shop
  amount: D;
}

export interface ProfitResult {
  salesRevenue: number;
  stockCost: number;
  profitOnSales: number;
  totalExpenses: number;
  /** part of totalExpenses that is this product's share of shop-wide expenses */
  sharedExpenses: number;
  netProfit: number;
  profitPct: number;
}

/** Attribute one sale's grand total to a single line, by subtotal share. */
export function attributedLineRevenue(
  sale: SaleForProfit,
  line: SaleLineForProfit,
): number {
  const subtotal = sale.lines.reduce((sum, l) => sum.plus(Dec(l.qty).times(Dec(l.rate))), Dec(0));
  if (subtotal.lte(0)) return 0;
  const totals = saleGrandTotal(
    sale.lines.map((l) => ({ qty: l.qty, rate: l.rate })),
    {
      discountPct: sale.discountPct,
      taxPct: sale.taxPct,
      loading: sale.loading,
      transport: sale.transport,
      labour: sale.labour,
    },
  );
  const share = Dec(line.qty).times(Dec(line.rate)).div(subtotal);
  return roundMoneyDecimal(Dec(totals.grandTotal).times(share)).toNumber();
}

export function computeProfit(
  sales: SaleForProfit[],
  expenses: ExpenseForProfit[],
  options: {
    productId?: string;
    /** shop-wide expenses and the revenue of ALL products in the period */
    shopExpenses?: { total: D; allSalesRevenue: D };
  } = {},
): ProfitResult {
  let salesRevenue = Dec(0);
  let stockCost = Dec(0);

  for (const sale of sales) {
    // Subtotal is computed over ALL lines so that discount, tax and flat
    // charges spread by each line's share of the full subtotal - the same
    // rule as attributedLineRevenue and saleGrandTotal.
    const subtotal = sale.lines.reduce((sum, l) => sum.plus(Dec(l.qty).times(Dec(l.rate))), Dec(0));
    if (subtotal.lte(0)) continue;
    const totals = saleGrandTotal(
      sale.lines.map((l) => ({ qty: l.qty, rate: l.rate })),
      {
        discountPct: sale.discountPct,
        taxPct: sale.taxPct,
        loading: sale.loading,
        transport: sale.transport,
        labour: sale.labour,
      },
    );

    // When scoped to a product, only that product's lines contribute to
    // revenue and stock cost. Charges/tax/discount are still spread across
    // the full subtotal (computed above), so per-product totals reconcile.
    for (const line of sale.lines) {
      if (options.productId && line.productId !== options.productId) continue;
      const share = Dec(line.qty).times(Dec(line.rate)).div(subtotal);
      salesRevenue = salesRevenue.plus(Dec(totals.grandTotal).times(share));
      stockCost = stockCost.plus(Dec(line.qty).times(Dec(line.unitCost)));
    }
  }

  const revenueRounded = roundMoneyDecimal(salesRevenue);
  const costRounded = roundMoneyDecimal(stockCost);
  const profitRounded = roundMoneyDecimal(revenueRounded.minus(costRounded));

  const totalExpensesDec = expenses
    .filter((e) => !options.productId || e.productId === options.productId)
    .reduce((sum, e) => sum.plus(Dec(e.amount)), Dec(0));

  // Product view: shop-wide expenses (no product) are shared by each
  // product's share of all sales, so per-product net profits add up to the
  // All Products net profit.
  let sharedExpenses = Dec(0);
  if (options.productId && options.shopExpenses) {
    const allRevenue = Dec(options.shopExpenses.allSalesRevenue);
    if (allRevenue.gt(0)) {
      sharedExpenses = roundMoneyDecimal(
        Dec(options.shopExpenses.total).times(revenueRounded).div(allRevenue),
      );
    }
  }
  const totalExpenses = roundMoneyDecimal(totalExpensesDec.plus(sharedExpenses));

  const netProfit = roundMoneyDecimal(profitRounded.minus(totalExpenses));
  const profitPct = revenueRounded.gt(0)
    ? roundMoneyDecimal(netProfit.div(revenueRounded).times(100))
    : Dec(0);

  return {
    salesRevenue: revenueRounded.toNumber(),
    stockCost: costRounded.toNumber(),
    profitOnSales: profitRounded.toNumber(),
    totalExpenses: totalExpenses.toNumber(),
    sharedExpenses: sharedExpenses.toNumber(),
    netProfit: netProfit.toNumber(),
    profitPct: profitPct.toNumber(),
  };
}
