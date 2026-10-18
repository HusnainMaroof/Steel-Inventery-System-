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
  options: { productId?: string } = {},
): ProfitResult {
  let salesRevenue = Dec(0);
  let stockCost = Dec(0);

  for (const sale of sales) {
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

    for (const line of sale.lines) {
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
  const totalExpenses = roundMoneyDecimal(totalExpensesDec);

  const netProfit = roundMoneyDecimal(profitRounded.minus(totalExpenses));
  const profitPct = revenueRounded.gt(0)
    ? roundMoneyDecimal(netProfit.div(revenueRounded).times(100))
    : Dec(0);

  return {
    salesRevenue: revenueRounded.toNumber(),
    stockCost: costRounded.toNumber(),
    profitOnSales: profitRounded.toNumber(),
    totalExpenses: totalExpenses.toNumber(),
    netProfit: netProfit.toNumber(),
    profitPct: profitPct.toNumber(),
  };
}
