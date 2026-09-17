import { monthLabel } from "./format";
import { purchaseParentId } from "./purchase-utils";
import {
  purchaseTotal,
  saleGrandTotal,
  saleTotal,
  steelAmount,
} from "./store";
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
      landed: p.qty > 0 ? purchaseTotal(p) / p.qty : 0,
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
  return lots.reduce((a, l) => a + l.remaining * l.landed, 0);
}

function productShareOfSale(s: Sale, match: (l: SaleLine) => boolean) {
  const sub = saleTotal(s);
  if (sub <= 0) return s.lines.some(match) ? 1 : 0;
  let part = 0;
  for (const l of s.lines) if (match(l)) part += l.qty * l.rate;
  return part / sub;
}

function attributedLineRevenue(s: Sale, l: SaleLine) {
  const sub = saleTotal(s);
  if (sub <= 0) return 0;
  return ((l.qty * l.rate) / sub) * saleGrandTotal(s);
}

function cashReceivedInPeriod(
  sales: Sale[],
  payments: Payment[],
  from: string,
  to: string,
  productId: string,
  match: (l: SaleLine) => boolean
) {
  const due: Record<string, number> = {};
  const byId: Record<string, Sale> = {};
  for (const s of sales) {
    due[s.id] = saleGrandTotal(s);
    byId[s.id] = s;
  }

  let received = 0;
  const credit = (sale: Sale | undefined, amount: number, date: string) => {
    if (amount <= 0.000001 || !inDateRange(date, from, to)) return;
    if (!sale) {
      if (!productId) received += amount;
      return;
    }
    received += amount * (productId ? productShareOfSale(sale, match) : 1);
  };

  const settle = (saleId: string, amount: number) => {
    const cap = Math.max(0, due[saleId] ?? 0);
    const take = Math.min(amount, cap);
    due[saleId] = cap - take;
    return amount - take;
  };

  const pmts = payments
    .filter((p) => p.type === "customer")
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  for (const p of pmts) {
    if (p.saleId) {
      credit(byId[p.saleId], p.amount, p.date);
      settle(p.saleId, p.amount);
      continue;
    }
    let left = p.amount;
    const oldest = sales
      .filter((s) => s.customerId === p.partyId)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    for (const s of oldest) {
      if (left <= 0.001) break;
      const cap = Math.max(0, due[s.id] ?? 0);
      const take = Math.min(left, cap);
      due[s.id] = cap - take;
      credit(s, take, p.date);
      left -= take;
    }
    if (left > 0.001) credit(undefined, left, p.date);
  }
  return received;
}

function cashPaidInPeriod(
  purchases: Purchase[],
  payments: Payment[],
  from: string,
  to: string,
  productId: string,
  match: (p: Purchase) => boolean
) {
  let paid = 0;
  for (const p of payments) {
    if (p.type !== "supplier" || !inDateRange(p.date, from, to)) continue;
    if (!productId) {
      paid += p.amount;
      continue;
    }
    let all = 0;
    let part = 0;
    for (const pur of purchases) {
      if (pur.supplierId !== p.partyId) continue;
      const amt = steelAmount(pur);
      all += amt;
      if (match(pur)) part += amt;
    }
    paid += all > 0 ? p.amount * (part / all) : 0;
  }
  return paid;
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
    let soldQty = 0;
    for (const s of input.sales) {
      if (!inDateRange(s.date, from, to)) continue;
      for (const l of s.lines) if (ofProd(l)) soldQty += l.qty;
    }
    const openingQty = open.reduce((a, l) => a + l.remaining, 0);
    const purchaseQty = buys.reduce((a, p) => a + p.qty, 0);
    const totalQty = openingQty + purchaseQty;
    let salesAmount = 0;
    for (const { sale, line } of periodSaleLines)
      if (ofProd(line)) salesAmount += attributedLineRevenue(sale, line);
    return {
      productId: prod.id,
      productName: prod.name,
      unit: prod.unit,
      openingQty,
      purchaseQty,
      totalQty,
      soldQty,
      remainingQty: totalQty - soldQty,
      openingValue: lotValue(open),
      purchaseValue: buys.reduce((a, p) => a + purchaseTotal(p), 0),
      remainingValue: lotValue(remain),
      salesAmount,
    };
  });

  const openingValue = stock.reduce((a, r) => a + r.openingValue, 0);
  const purchaseValue = stock.reduce((a, r) => a + r.purchaseValue, 0);
  const remainingValue = stock.reduce((a, r) => a + r.remainingValue, 0);

  let salesRevenue = 0;
  let stockCost = 0;
  for (const { sale, line, idx } of periodSaleLines) {
    salesRevenue += attributedLineRevenue(sale, line);
    stockCost +=
      line.qty * (input.lineUnitCost(sale.id, idx) || input.byItem[line.item] || 0);
  }
  const profitOnSales = salesRevenue - stockCost;

  const expenseOfProduct = (e: Expense) =>
    productId ? e.productId === productId : true;
  const periodExpenses = expensesInRange(input.expenses, from, to).filter(
    expenseOfProduct
  );
  const expensesApplied = periodExpenses.length > 0;
  const expenses = periodExpenses.reduce((a, e) => a + e.amount, 0);

  const purchaseCharges = { transport: 0, loading: 0, labour: 0, other: 0 };
  for (const p of input.purchases) {
    if (!inDateRange(p.date, from, to)) continue;
    if (!match(p)) continue;
    purchaseCharges.transport += p.transport;
    purchaseCharges.loading += p.loadingCharges ?? 0;
    purchaseCharges.labour += p.labourCharges ?? 0;
    purchaseCharges.other += p.otherCost;
  }

  const saleCharges = { loading: 0, transport: 0, labour: 0 };
  for (const s of input.sales) {
    if (!inDateRange(s.date, from, to)) continue;
    if (productId && !s.lines.some(match)) continue;
    const share = productId ? productShareOfSale(s, match) : 1;
    saleCharges.loading += (s.loadingCharges ?? 0) * share;
    saleCharges.transport += (s.transportCharges ?? 0) * share;
    saleCharges.labour += (s.labourCharges ?? 0) * share;
  }
  const netProfit = profitOnSales - expenses;
  const profitPctValue = salesRevenue > 0 ? (netProfit / salesRevenue) * 100 : 0;

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
  const openingExp = expensesInRange(input.expenses, dawn, openAsOf)
    .filter(expenseOfProduct)
    .reduce((a, e) => a + e.amount, 0);
  const cashExpenses = expenses;
  const openingCash = openingReceived - openingPaid - openingExp;
  const cashInHand = openingCash + cashReceived - cashPaid - cashExpenses;

  const suppliers: PartyDue[] = [];
  const bySup: Record<string, number> = {};
  const purchaseDue = new Map<string, { supplierId: string; goods: number; paid: number }>();
  for (const p of input.purchases) {
    if (!inDateRange(p.date, from, to)) continue;
    if (!match(p)) continue;
    const pid = purchaseParentId(p);
    const row = purchaseDue.get(pid) ?? {
      supplierId: p.supplierId,
      goods: 0,
      paid: p.paid ?? 0,
    };
    row.goods += steelAmount(p);
    purchaseDue.set(pid, row);
  }
  for (const row of purchaseDue.values()) {
    bySup[row.supplierId] =
      (bySup[row.supplierId] ?? 0) + Math.max(0, row.goods - row.paid);
  }
  for (const [id, due] of Object.entries(bySup)) {
    if (due <= 0.001) continue;
    const s = input.suppliers.find((x) => x.id === id);
    suppliers.push({ id, name: s?.name ?? id, due });
  }
  suppliers.sort((a, b) => b.due - a.due);
  const supplierDue = suppliers.reduce((a, r) => a + r.due, 0);

  const aging: Aging = { d0_30: 0, d31_60: 0, d61_90: 0, d90: 0 };
  const byCust: Record<string, { due: number; days: number }> = {};
  for (const s of input.sales) {
    if (!inDateRange(s.date, from, to)) continue;
    if (productId && !s.lines.some(match)) continue;
    const due = Math.max(0, saleGrandTotal(s) - input.salePaid(s.id));
    if (due <= 0.001) continue;
    const days = daysBetween(s.date, to);
    aging[agingBucket(days)] += due;
    const row = (byCust[s.customerId] ??= { due: 0, days: 0 });
    row.due += due;
    row.days = Math.max(row.days, days);
  }
  const customers: PartyDue[] = Object.entries(byCust)
    .filter(([, r]) => r.due > 0.001)
    .map(([id, r]) => {
      const c = input.customers.find((x) => x.id === id);
      return { id, name: c?.shop || c?.name || id, due: r.due, days: r.days };
    })
    .sort((a, b) => b.due - a.due);
  const customerDue = customers.reduce((a, r) => a + r.due, 0);

  const expenseRows: ExpenseLine[] = Object.entries(
    periodExpenses.reduce<Record<string, number>>((acc, e) => {
      const key = e.label.trim() || e.category;
      acc[key] = (acc[key] ?? 0) + e.amount;
      return acc;
    }, {})
  )
    .filter(([, amount]) => amount > 0.000001)
    .map(([key, amount]) => ({
      key,
      label: key,
      amount,
    }))
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
    totalStockValue: openingValue + purchaseValue,
    remainingValue,
    salesRevenue,
    stockCost,
    profitOnSales,
    expenses,
    expensesApplied,
    hasExpenses: input.expenses.length > 0,
    netProfit,
    profitPct: profitPctValue,
    openingCash,
    cashReceived,
    cashPaid,
    cashExpenses,
    cashInHand,
    customerDue,
    supplierDue,
    businessValue: remainingValue + customerDue + cashInHand,
    suppliers,
    customers,
    aging,
    expenseRows,
    purchaseCharges,
    saleCharges,
    stockChecks,
  };
}
