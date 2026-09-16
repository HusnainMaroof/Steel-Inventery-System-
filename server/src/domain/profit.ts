import { saleGrandTotal } from "./money";

/**
 * Profit engine (§27): the report is computed from transaction records, so
 * it can always answer "why is this number this amount".
 *
 * Revenue attribution: an invoice's flat charges and discount/tax are spread
 * across its lines in proportion to each line's share of the subtotal — the
 * same rule as `saleGrandTotal`, so figures reconcile with invoices.
 */
export interface SaleLineForProfit {
  productId: string;
  qty: number;
  rate: number;
  /** Landed cost per unit of this line (from its source purchase). */
  unitCost: number;
}

export interface SaleForProfit {
  saleId: string;
  lines: SaleLineForProfit[];
  discountPct: number;
  taxPct: number;
  loading: number;
  transport: number;
  labour: number;
}

export interface ExpenseForProfit {
  productId?: string; // absent = whole shop
  amount: number;
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
  const subtotal = sale.lines.reduce((sum, l) => sum + l.qty * l.rate, 0);
  if (subtotal <= 0) return 0;
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
  const share = (line.qty * line.rate) / subtotal;
  return round2(totals.grandTotal * share);
}

export function computeProfit(
  sales: SaleForProfit[],
  expenses: ExpenseForProfit[],
  options: { productId?: string } = {},
): ProfitResult {
  let salesRevenue = 0;
  let stockCost = 0;

  for (const sale of sales) {
    const subtotal = sale.lines.reduce((sum, l) => sum + l.qty * l.rate, 0);
    if (subtotal <= 0) continue;
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
      const share = (line.qty * line.rate) / subtotal;
      salesRevenue += totals.grandTotal * share;
      stockCost += line.qty * line.unitCost;
    }
  }

  salesRevenue = round2(salesRevenue);
  stockCost = round2(stockCost);
  const profitOnSales = round2(salesRevenue - stockCost);

  const totalExpenses = round2(
    expenses
      .filter((e) => !options.productId || e.productId === options.productId)
      .reduce((sum, e) => sum + e.amount, 0),
  );

  const netProfit = round2(profitOnSales - totalExpenses);
  const profitPct = salesRevenue > 0 ? round2((netProfit / salesRevenue) * 100) : 0;

  return { salesRevenue, stockCost, profitOnSales, totalExpenses, netProfit, profitPct };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
