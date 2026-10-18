import { monthLabel } from "./format";
import Decimal from "decimal.js";
import { purchaseParentId } from "./purchase-utils";
import { round2, round3, sumDecimal, toDecimal } from "./decimal";
import { purchaseTotal, saleGrandTotal, steelAmount } from "./store";
import type {
  Customer,
  Expense,
  Payment,
  Product,
  ProductCategory,
  Purchase,
  Sale,
  SaleLine,
  StockCheck,
  Supplier,
  Variant,
} from "./types";

export type ReportMode = "month" | "year" | "all" | "range";

export interface QtyBlock {
  productId: string;
  productName: string;
  unit: string;
  openingQty: number;
  purchaseQty: number;
  totalQty: number;
  soldQty: number;
  remainingQty: number;
  openingValue: number;
  purchaseValue: number;
  remainingValue: number;
  salesAmount: number;
}

export interface PartyDue {
  id: string;
  name: string;
  place?: string;
  due: number;
  days?: number;
}

export interface Aging {
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d90: number;
}

export interface ExpenseLine {
  key: string;
  label: string;
  amount: number;
}

export interface StockCheckView {
  productId: string;
  productName: string;
  unit: string;
  systemQty: number;
  physicalQty: number | null;
  difference: number | null;
  checkedOn?: string;
}

export interface ProfitReport {
  mode: ReportMode;
  from: string;
  to: string;
  periodLabel: string;
  productId: string;
  productLabel: string;
  stock: QtyBlock[];
  openingValue: number;
  purchaseValue: number;
  totalStockValue: number;
  remainingValue: number;
  salesRevenue: number;
  stockCost: number;
  profitOnSales: number;
  expenses: number;
  expensesApplied: boolean;
  hasExpenses: boolean;
  netProfit: number;
  profitPct: number;
  openingCash: number;
  cashReceived: number;
  cashPaid: number;
  cashExpenses: number;
  cashInHand: number;
  customerDue: number;
  supplierDue: number;
  businessValue: number;
  suppliers: PartyDue[];
  customers: PartyDue[];
  aging: Aging;
  expenseRows: ExpenseLine[];
  purchaseCharges: { transport: number; loading: number; labour: number; other: number };
  saleCharges: { loading: number; transport: number; labour: number };
  stockChecks: StockCheckView[];
}

export interface ProfitReportInput {
  mode: ReportMode;
  year: number;
  month?: number;
  rangeFrom?: string;
  rangeTo?: string;
  productId: string;
  now?: Date;
  products: Product[];
  categories: ProductCategory[];
  variants: Variant[];
  productItems: { name: string; productId: string }[];
  purchases: Purchase[];
  sales: Sale[];
  payments: Payment[];
  expenses: Expense[];
  customers: Customer[];
  suppliers: Supplier[];
  lineUnitCost: (saleId: string, lineIdx: number) => number;
  byItem: Record<string, number>;
  salePaid: (id: string) => number;
  stockChecks: StockCheck[];
}

type Ident = { categoryId?: string; variantId?: string; item: string };

export function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function inDateRange(date: string, from: string, to: string) {
  const d = date.slice(0, 10);
  return d >= from && d <= to;
}

export function recordProductId(
  r: Ident,
  varProd: Map<string, string>,
  catProd: Map<string, string>,
  itemProd: Map<string, string>
) {
  return (
    (r.variantId && varProd.get(r.variantId)) ||
    (r.categoryId && catProd.get(r.categoryId)) ||
    itemProd.get(r.item) ||
    ""
  );
}

export function productMapsOf(
  variants: Variant[],
  categories: ProductCategory[],
  productItems: { name: string; productId: string }[]
) {
  return {
    varProd: new Map(
      variants.filter((v) => v.productId).map((v) => [v.id, v.productId as string])
    ),
    catProd: new Map(categories.map((c) => [c.id, c.productId])),
    itemProd: new Map(productItems.map((it) => [it.name, it.productId])),
  };
}

export function matchesProduct(
  r: Ident,
  productId: string,
  productOf: (r: Ident) => string
) {
  if (!productId) return true;
  return productOf(r) === productId;
}

export function periodBounds(
  mode: ReportMode,
  year: number,
  month?: number,
  now = new Date(),
  range?: { from?: string; to?: string }
): { from: string; to: string } {
  if (mode === "range")
    return { from: range?.from || "2000-01-01", to: range?.to || ymd(now) };
  if (mode === "all") return { from: "2000-01-01", to: ymd(now) };
  if (mode === "year") return { from: `${year}-01-01`, to: `${year}-12-31` };
  const m = month ?? now.getMonth() + 1;
  const from = `${year}-${String(m).padStart(2, "0")}-01`;
  return { from, to: ymd(new Date(year, m, 0)) };
}

export function periodLabelOf(mode: ReportMode, year: number, month?: number) {
  if (mode === "range") return "Custom range";
  if (mode === "all") return "All time";
  if (mode === "year") return String(year);
  const m = month ?? 1;
  return monthLabel(`${year}-${String(m).padStart(2, "0")}`);
}

export function monthOptions(now = new Date()) {
  const endY = now.getFullYear();
  const opts: { value: string; label: string }[] = [];
  for (let y = 2024; y <= endY; y++) {
    for (let m = 1; m <= 12; m++) {
      const value = `${y}-${String(m).padStart(2, "0")}`;
      opts.push({ value, label: monthLabel(value) });
    }
  }
  return opts;
}

export function yearOptions(now = new Date()) {
  const opts: { value: string; label: string }[] = [];
  for (let y = 2024; y <= now.getFullYear(); y++) {
    opts.push({ value: String(y), label: String(y) });
  }
  return opts;
}

function dayBefore(iso: string) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return ymd(d);
}

function daysBetween(from: string, to: string) {
  const a = new Date(from + "T00:00:00").getTime();
  const b = new Date(to + "T00:00:00").getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function agingBucket(days: number): keyof Aging {
  if (days <= 30) return "d0_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  return "d90";
}

type Lot = { p: Purchase; remaining: number; landed: number };

function consume(elig: Lot[], qty: number) {
  let left = qty;
  for (const lot of elig) {
    if (left <= 0) break;
    if (lot.remaining <= 0.000001) continue;
    const take = Math.min(lot.remaining, left);
    lot.remaining -= take;
    left -= take;
  }
}

/** Remaining FIFO lots as of a calendar date (inclusive). Mirrors store allocation. */
export function lotsAsOf(purchases: Purchase[], sales: Sale[], asOf: string): Lot[] {
  const lots: Lot[] = [...purchases]
    .filter((p) => p.date <= asOf)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map((p) => ({
      p,
      remaining: p.qty,
      landed: p.qty > 0 ? toDecimal(purchaseTotal(p)).div(p.qty).toNumber() : 0,
    }));

  for (const s of [...sales].reverse()) {
    if (s.date > asOf) continue;
    for (const l of s.lines) {
      if (l.purchaseId) {
        const elig = lots.filter((x) => purchaseParentId(x.p) === l.purchaseId);
        consume(elig, l.qty);
      } else {
        let elig = lots.filter((x) => x.p.item === l.item);
        if (l.supplierId) elig = elig.filter((x) => x.p.supplierId === l.supplierId);
        if (l.variantId) elig = elig.filter((x) => x.p.variantId === l.variantId);
        consume(elig, l.qty);
      }
    }
  }
  return lots.filter((l) => l.remaining > 0.000001);
}

function lotValue(lots: Lot[]) {
  return round2(sumDecimal(lots.map((l) => toDecimal(l.remaining).times(l.landed))));
}

/** Exact goods value of one sale line (qty x rate, unrounded). */
function lineGoodsExact(l: SaleLine): Decimal {
  return toDecimal(l.qty).times(l.rate);
}

/** Exact goods subtotal of a sale, before discount and tax. */
function saleGoodsExact(s: Sale): Decimal {
  return sumDecimal(s.lines.map(lineGoodsExact));
}

function productShareOfSale(s: Sale, match: (l: SaleLine) => boolean): Decimal {
  const sub = saleGoodsExact(s);
  if (sub.lte(0)) return new Decimal(s.lines.some(match) ? 1 : 0);
  let part = new Decimal(0);
  for (const l of s.lines) if (match(l)) part = part.plus(lineGoodsExact(l));
  return part.div(sub);
}

/** Invoice grand total share of one line, unrounded. Callers round the final sum. */
function attributedLineRevenue(s: Sale, l: SaleLine): Decimal {
  const sub = saleGoodsExact(s);
  if (sub.lte(0)) return new Decimal(0);
  return lineGoodsExact(l).div(sub).times(toDecimal(saleGrandTotal(s)));
}

function cashReceivedInPeriod(
  sales: Sale[],
  payments: Payment[],
  from: string,
  to: string,
  productId: string,
  match: (l: SaleLine) => boolean
) {
  const due: Record<string, Decimal> = {};
  const byId: Record<string, Sale> = {};
  for (const s of sales) {
    due[s.id] = toDecimal(saleGrandTotal(s));
    byId[s.id] = s;
  }

  let received = new Decimal(0);
  const credit = (sale: Sale | undefined, amount: Decimal, date: string) => {
    if (amount.lte(0.000001) || !inDateRange(date, from, to)) return;
    if (!sale) {
      if (!productId) received = received.plus(amount);
      return;
    }
    const share = productId ? productShareOfSale(sale, match) : new Decimal(1);
    received = received.plus(amount.times(share));
  };

  const settle = (saleId: string, amount: Decimal) => {
    const cap = Decimal.max(0, due[saleId] ?? 0);
    const take = Decimal.min(amount, cap);
    due[saleId] = cap.minus(take);
    return amount.minus(take);
  };

  const pmts = payments
    .filter((p) => p.type === "customer")
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  for (const p of pmts) {
    const amount = toDecimal(p.amount);
    if (p.saleId) {
      credit(byId[p.saleId], amount, p.date);
      settle(p.saleId, amount);
      continue;
    }
    let left = amount;
    const oldest = sales
      .filter((s) => s.customerId === p.partyId)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    for (const s of oldest) {
      if (left.lte(0.001)) break;
      const cap = Decimal.max(0, due[s.id] ?? 0);
      const take = Decimal.min(left, cap);
      due[s.id] = cap.minus(take);
      credit(s, take, p.date);
      left = left.minus(take);
    }
    if (left.gt(0.001)) credit(undefined, left, p.date);
  }
  return round2(received);
}

function cashPaidInPeriod(
  purchases: Purchase[],
  payments: Payment[],
  from: string,
  to: string,
  productId: string,
  match: (p: Purchase) => boolean
) {
  let paid = new Decimal(0);
  for (const p of payments) {
    if (p.type !== "supplier" || !inDateRange(p.date, from, to)) continue;
    if (!productId) {
      paid = paid.plus(p.amount);
      continue;
    }
    let all = new Decimal(0);
    let part = new Decimal(0);
    for (const pur of purchases) {
      if (pur.supplierId !== p.partyId) continue;
      const amt = toDecimal(steelAmount(pur));
      all = all.plus(amt);
      if (match(pur)) part = part.plus(amt);
    }
    if (all.gt(0)) paid = paid.plus(toDecimal(p.amount).times(part).div(all));
  }
  return round2(paid);
}

function expensesInRange(expenses: Expense[], from: string, to: string) {
  return expenses.filter((e) => inDateRange(e.date, from, to));
}

export function buildProfitReport(input: ProfitReportInput): ProfitReport {
  const now = input.now ?? new Date();
  const { from, to } = periodBounds(
    input.mode,
    input.year,
    input.month,
    now,
    { from: input.rangeFrom, to: input.rangeTo }
  );
  const productId = input.productId;
  const maps = productMapsOf(input.variants, input.categories, input.productItems);
  const productOf = (r: Ident) =>
    recordProductId(r, maps.varProd, maps.catProd, maps.itemProd);
  const match = (r: Ident) => matchesProduct(r, productId, productOf);

  const activeProducts = input.products.filter((p) => p.active !== false);
  const productLabel =
    activeProducts.find((p) => p.id === productId)?.name ?? "All Products";
  const scopedProducts = productId
    ? activeProducts.filter((p) => p.id === productId)
    : activeProducts;

  const openAsOf = dayBefore(from);
  const openingLots = lotsAsOf(input.purchases, input.sales, openAsOf);
  const remainingLots = lotsAsOf(input.purchases, input.sales, to);

  const periodSaleLines: { sale: Sale; line: SaleLine; idx: number }[] = [];
  for (const s of input.sales) {
    if (!inDateRange(s.date, from, to)) continue;
    s.lines.forEach((line, idx) => {
      if (match(line)) periodSaleLines.push({ sale: s, line, idx });
    });
  }

  const stock: QtyBlock[] = scopedProducts.map((prod) => {
    const ofProd = (r: Ident) => productOf(r) === prod.id;
    const open = openingLots.filter((l) => ofProd(l.p));
    const remain = remainingLots.filter((l) => ofProd(l.p));
    const buys = input.purchases.filter(
      (p) => inDateRange(p.date, from, to) && ofProd(p)
    );
    const soldParts: Decimal[] = [];
    for (const s of input.sales) {
      if (!inDateRange(s.date, from, to)) continue;
      for (const l of s.lines) if (ofProd(l)) soldParts.push(toDecimal(l.qty));
    }
    const soldQty = round3(sumDecimal(soldParts));
    const openingQty = round3(sumDecimal(open.map((l) => l.remaining)));
    const purchaseQty = round3(sumDecimal(buys.map((p) => p.qty)));
    const totalQty = round3(toDecimal(openingQty).plus(purchaseQty));
    let salesAmount = new Decimal(0);
    for (const { sale, line } of periodSaleLines)
      if (ofProd(line)) salesAmount = salesAmount.plus(attributedLineRevenue(sale, line));
    return {
      productId: prod.id,
      productName: prod.name,
      unit: prod.unit,
      openingQty,
      purchaseQty,
      totalQty,
      soldQty,
      remainingQty: round3(toDecimal(totalQty).minus(soldQty)),
      openingValue: lotValue(open),
      purchaseValue: round2(sumDecimal(buys.map((p) => purchaseTotal(p)))),
      remainingValue: lotValue(remain),
      salesAmount: round2(salesAmount),
    };
  });

  const openingValue = round2(sumDecimal(stock.map((r) => r.openingValue)));
  const purchaseValue = round2(sumDecimal(stock.map((r) => r.purchaseValue)));
  const remainingValue = round2(sumDecimal(stock.map((r) => r.remainingValue)));

  const revenueParts: Decimal[] = [];
  const costParts: Decimal[] = [];
  for (const { sale, line, idx } of periodSaleLines) {
    revenueParts.push(attributedLineRevenue(sale, line));
    costParts.push(
      toDecimal(line.qty).times(input.lineUnitCost(sale.id, idx) || input.byItem[line.item] || 0),
    );
  }
  const salesRevenueExact = sumDecimal(revenueParts);
  const stockCostExact = sumDecimal(costParts);
  const salesRevenue = round2(salesRevenueExact);
  const stockCost = round2(stockCostExact);
  const profitOnSales = round2(salesRevenueExact.minus(stockCostExact));

  const expenseOfProduct = (e: Expense) =>
    productId ? e.productId === productId : true;
  const periodExpenses = expensesInRange(input.expenses, from, to).filter(
    expenseOfProduct
  );
  const expensesApplied = periodExpenses.length > 0;
  const expenses = round2(sumDecimal(periodExpenses.map((e) => e.amount)));

  const pcTransport: Decimal[] = [];
  const pcLoading: Decimal[] = [];
  const pcLabour: Decimal[] = [];
  const pcOther: Decimal[] = [];
  for (const p of input.purchases) {
    if (!inDateRange(p.date, from, to)) continue;
    if (!match(p)) continue;
    pcTransport.push(toDecimal(p.transport));
    pcLoading.push(toDecimal(p.loadingCharges));
    pcLabour.push(toDecimal(p.labourCharges));
    pcOther.push(toDecimal(p.otherCost));
  }
  const purchaseCharges = {
    transport: round2(sumDecimal(pcTransport)),
    loading: round2(sumDecimal(pcLoading)),
    labour: round2(sumDecimal(pcLabour)),
    other: round2(sumDecimal(pcOther)),
  };

  const scLoading: Decimal[] = [];
  const scTransport: Decimal[] = [];
  const scLabour: Decimal[] = [];
  for (const s of input.sales) {
    if (!inDateRange(s.date, from, to)) continue;
    if (productId && !s.lines.some(match)) continue;
    const share = productId ? productShareOfSale(s, match) : new Decimal(1);
    scLoading.push(toDecimal(s.loadingCharges).times(share));
    scTransport.push(toDecimal(s.transportCharges).times(share));
    scLabour.push(toDecimal(s.labourCharges).times(share));
  }
  const saleCharges = {
    loading: round2(sumDecimal(scLoading)),
    transport: round2(sumDecimal(scTransport)),
    labour: round2(sumDecimal(scLabour)),
  };
  const netProfitExact = toDecimal(profitOnSales).minus(expenses);
  const netProfit = round2(netProfitExact);
  const profitPctValue = salesRevenue > 0
    ? netProfitExact.div(salesRevenue).times(100).toNumber()
    : 0;

  const dawn = "2000-01-01";
  const cashReceived = cashReceivedInPeriod(
    input.sales,
    input.payments,
    from,
    to,
    productId,
    match
  );
  const cashPaid = cashPaidInPeriod(
    input.purchases,
    input.payments,
    from,
    to,
    productId,
    match
  );
  const openingReceived = cashReceivedInPeriod(
    input.sales,
    input.payments,
    dawn,
    openAsOf,
    productId,
    match
  );
  const openingPaid = cashPaidInPeriod(
    input.purchases,
    input.payments,
    dawn,
    openAsOf,
    productId,
    match
  );
  const openingExp = round2(
    sumDecimal(
      expensesInRange(input.expenses, dawn, openAsOf)
        .filter(expenseOfProduct)
        .map((e) => e.amount),
    ),
  );
  const cashExpenses = expenses;
  const openingCash = toDecimal(openingReceived).minus(openingPaid).minus(openingExp);
  const cashInHand = round2(
    openingCash.plus(cashReceived).minus(cashPaid).minus(cashExpenses),
  );

  const suppliers: PartyDue[] = [];
  const bySup: Record<string, number> = {};
  const purchaseDue = new Map<string, { supplierId: string; goods: Decimal; paid: number }>();
  for (const p of input.purchases) {
    if (!inDateRange(p.date, from, to)) continue;
    if (!match(p)) continue;
    const pid = purchaseParentId(p);
    const row = purchaseDue.get(pid) ?? {
      supplierId: p.supplierId,
      goods: new Decimal(0),
      paid: p.paid ?? 0,
    };
    row.goods = row.goods.plus(toDecimal(steelAmount(p)));
    purchaseDue.set(pid, row);
  }
  const bySupExact: Record<string, Decimal> = {};
  for (const row of purchaseDue.values()) {
    const owed = Decimal.max(0, row.goods.minus(row.paid));
    bySupExact[row.supplierId] = (bySupExact[row.supplierId] ?? new Decimal(0)).plus(owed);
  }
  for (const [supplierKey, dueExact] of Object.entries(bySupExact)) {
    bySup[supplierKey] = round2(dueExact);
  }
  for (const [id, due] of Object.entries(bySup)) {
    if (due <= 0.001) continue;
    const s = input.suppliers.find((x) => x.id === id);
    suppliers.push({
      id,
      name: s?.name?.trim() || id,
      place: s?.mill?.trim() || undefined,
      due,
    });
  }
  suppliers.sort((a, b) => b.due - a.due);
  const supplierDue = round2(sumDecimal(suppliers.map((r) => r.due)));

  const agingExact: Record<keyof Aging, Decimal[]> = { d0_30: [], d31_60: [], d61_90: [], d90: [] };
  const byCust: Record<string, { due: Decimal[]; days: number }> = {};
  for (const s of input.sales) {
    if (!inDateRange(s.date, from, to)) continue;
    if (productId && !s.lines.some(match)) continue;
    const due = Decimal.max(0, toDecimal(saleGrandTotal(s)).minus(input.salePaid(s.id)));
    if (due.lte(0.001)) continue;
    const days = daysBetween(s.date, to);
    agingExact[agingBucket(days)].push(due);
    const row = (byCust[s.customerId] ??= { due: [], days: 0 });
    row.due.push(due);
    row.days = Math.max(row.days, days);
  }
  const aging: Aging = {
    d0_30: round2(sumDecimal(agingExact.d0_30)),
    d31_60: round2(sumDecimal(agingExact.d31_60)),
    d61_90: round2(sumDecimal(agingExact.d61_90)),
    d90: round2(sumDecimal(agingExact.d90)),
  };
  const customers: PartyDue[] = Object.entries(byCust)
    .map(([id, r]) => ({ id, dueExact: sumDecimal(r.due), days: r.days }))
    .filter((r) => r.dueExact.gt(0.001))
    .map((r) => {
      const c = input.customers.find((x) => x.id === r.id);
      return {
        id: r.id,
        name: c?.name?.trim() || r.id,
        place: c?.shop?.trim() || undefined,
        due: round2(r.dueExact),
        days: r.days,
      };
    })
    .sort((a, b) => b.due - a.due);
  const customerDue = round2(sumDecimal(customers.map((r) => r.due)));

  const expenseByKey: Record<string, Decimal> = {};
  for (const e of periodExpenses) {
    const key = e.label.trim() || e.category;
    expenseByKey[key] = (expenseByKey[key] ?? new Decimal(0)).plus(toDecimal(e.amount));
  }
  const expenseRows: ExpenseLine[] = Object.entries(expenseByKey)
    .map(([key, amountExact]) => ({ key, label: key, amount: round2(amountExact) }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const stockChecks: StockCheckView[] = stock.map((b) => {
    const check = input.stockChecks
      .filter((c) => c.productId === b.productId && c.date >= from && c.date <= to)
      .sort((a, c) => c.date.localeCompare(a.date) || c.id.localeCompare(a.id))[0];
    const physical = check ? check.physicalQty : null;
    return {
      productId: b.productId,
      productName: b.productName,
      unit: b.unit,
      systemQty: b.remainingQty,
      physicalQty: physical,
      difference: physical == null ? null : physical - b.remainingQty,
      checkedOn: check?.date,
    };
  });

  return {
    mode: input.mode,
    from,
    to,
    periodLabel: periodLabelOf(input.mode, input.year, input.month),
    productId,
    productLabel,
    stock,
    openingValue,
    purchaseValue,
    totalStockValue: round2(sumDecimal([openingValue, purchaseValue])),
    remainingValue,
    salesRevenue,
    stockCost,
    profitOnSales,
    expenses,
    expensesApplied,
    hasExpenses: input.expenses.length > 0,
    netProfit,
    profitPct: profitPctValue,
    openingCash: round2(openingCash),
    cashReceived,
    cashPaid,
    cashExpenses,
    cashInHand,
    customerDue,
    supplierDue,
    businessValue: round2(sumDecimal([remainingValue, customerDue, cashInHand])),
    suppliers,
    customers,
    aging,
    expenseRows,
    purchaseCharges,
    saleCharges,
    stockChecks,
  };
}
