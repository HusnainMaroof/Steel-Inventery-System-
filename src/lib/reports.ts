import { purchaseTotal, saleGrandTotal, steelAmount } from "./store";
import { fmtMoney, fmtPct } from "./format";
import type { ProductCategory, Purchase, Sale, SaleLine, Variant } from "./types";

export type ReportPeriod =
  | "today"
  | "week"
  | "month"
  | "lastMonth"
  | "year"
  | "lastYear"
  | "custom";

export const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "year", label: "This year" },
  { value: "lastYear", label: "Last year" },
  { value: "custom", label: "Custom date" },
];

export function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeekMonday(now: Date) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

export function reportRange(
  period: ReportPeriod,
  customFrom: string,
  customTo: string,
  now = new Date()
): { from: string; to: string } {
  const today = ymd(now);
  if (period === "today") return { from: today, to: today };
  if (period === "week") return { from: ymd(startOfWeekMonday(now)), to: today };
  if (period === "month") {
    return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  }
  if (period === "lastMonth") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: ymd(from), to: ymd(to) };
  }
  if (period === "year") return { from: `${now.getFullYear()}-01-01`, to: today };
  if (period === "lastYear") {
    const y = now.getFullYear() - 1;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  const from = customFrom || ymd(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = customTo || today;
  return from <= to ? { from, to } : { from: to, to: from };
}

export function rangeLabel(period: ReportPeriod, from: string, to: string) {
  const opt = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "Custom date";
  const pretty = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  if (from === to) return `${opt} (${pretty(from)})`;
  return `${opt} (${pretty(from)} to ${pretty(to)})`;
}

export function inDateRange(date: string, from: string, to: string) {
  const d = date.slice(0, 10);
  return d >= from && d <= to;
}

export function monthKeysInRange(from: string, to: string) {
  const keys: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const ey = Number(to.slice(0, 4));
  const em = Number(to.slice(5, 7));
  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

export function yearKeysInRange(from: string, to: string) {
  const keys: string[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) keys.push(String(y));
  return keys;
}

export function recordProductId(
  r: { categoryId?: string; variantId?: string; item: string },
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
  r: { categoryId?: string; variantId?: string; item: string },
  productId: string,
  productOf: (r: { categoryId?: string; variantId?: string; item: string }) => string
) {
  if (!productId) return true;
  return productOf(r) === productId;
}

export function purchaseAmount(p: Purchase) {
  return purchaseTotal(p);
}

export function lineAmount(l: SaleLine) {
  return l.qty * l.rate;
}

export type PerfRow = {
  key: string;
  label: string;
  purchases: number;
  sales: number;
  profit: number;
};

export function profitPct(sold: number, profit: number) {
  if (sold <= 0) return 0;
  return (profit / sold) * 100;
}

export function customerDueOf(
  sales: Sale[],
  salePaid: (id: string) => number,
  productId: string,
  matchLine: (l: SaleLine) => boolean
) {
  let total = 0;
  for (const s of sales) {
    if (productId && !s.lines.some(matchLine)) continue;
    total += Math.max(0, saleGrandTotal(s) - salePaid(s.id));
  }
  return total;
}

export function supplierDueOf(
  purchases: Purchase[],
  productId: string,
  matchPurchase: (p: Purchase) => boolean
) {
  let total = 0;
  for (const p of purchases) {
    if (productId && !matchPurchase(p)) continue;
    total += Math.max(0, steelAmount(p) - (p.paid ?? 0));
  }
  return total;
}

function csvCell(v: string | number) {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export type ReportExport = {
  dateLabel: string;
  productLabel: string;
  purchased: number;
  sold: number;
  profit: number;
  stockCost: number;
  stockValue: number;
  customerDue: number;
  supplierDue: number;
  perfKind: "month" | "year";
  perf: PerfRow[];
};

export function reportCsv(ex: ReportExport) {
  const pct = profitPct(ex.sold, ex.profit);
  const lines = [
    ["Profit & Reports"],
    ["Date", ex.dateLabel],
    ["Product", ex.productLabel],
    [],
    ["Total purchases", ex.purchased],
    ["Total sales", ex.sold],
    ["Profit", ex.profit],
    ["Stock value", ex.stockValue],
    ["Customer due", ex.customerDue],
    ["Supplier due", ex.supplierDue],
    [],
    ["Profit calculation"],
    ["Sales", ex.sold],
    ["Stock cost", ex.stockCost],
    ["Profit", ex.profit],
    ["Profit %", fmtPct(pct)],
    [],
    ["Business performance"],
    [ex.perfKind === "year" ? "Year" : "Month", "Purchases", "Sales", "Profit"],
    ...ex.perf.map((r) => [r.label, r.purchases, r.sales, r.profit]),
    [],
    ["Money owed"],
    ["Customer due", ex.customerDue],
    ["Supplier due", ex.supplierDue],
  ];
  return lines.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadReportCsv(ex: ReportExport) {
  const blob = new Blob(["\uFEFF" + reportCsv(ex)], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const stamp = ymd(new Date());
  a.download = `profit-report-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function printReportPdf(ex: ReportExport) {
  const pct = profitPct(ex.sold, ex.profit);
  const money = (n: number) => fmtMoney(n);
  const rows = ex.perf
    .map(
      (r) =>
        `<tr><td>${r.label}</td><td>${money(r.purchases)}</td><td>${money(r.sales)}</td><td>${money(r.profit)}</td></tr>`
    )
    .join("");
  const html = `<!doctype html><html><head><title>Profit & Reports</title>
<style>
  body { font-family: Inter, Arial, sans-serif; color: #171717; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { margin: 0 0 4px; font-size: 13px; }
  h2 { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; margin: 24px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 0; border-bottom: 1px solid #e5e5e5; }
  td:nth-child(n+2), th:nth-child(n+2) { text-align: right; }
</style></head><body>
<h1>Profit & Reports</h1>
<p>Date: ${ex.dateLabel}</p>
<p>Product: ${ex.productLabel}</p>
<h2>Summary</h2>
<table>
<tr><td>Total purchases</td><td>${money(ex.purchased)}</td></tr>
<tr><td>Total sales</td><td>${money(ex.sold)}</td></tr>
<tr><td>Profit</td><td>${money(ex.profit)}</td></tr>
<tr><td>Stock value</td><td>${money(ex.stockValue)}</td></tr>
<tr><td>Customer due</td><td>${money(ex.customerDue)}</td></tr>
<tr><td>Supplier due</td><td>${money(ex.supplierDue)}</td></tr>
</table>
<h2>Profit calculation</h2>
<table>
<tr><td>Sales</td><td>${money(ex.sold)}</td></tr>
<tr><td>Stock cost</td><td>${money(ex.stockCost)}</td></tr>
<tr><td>Profit</td><td>${money(ex.profit)}</td></tr>
<tr><td>Profit %</td><td>${fmtPct(pct)}</td></tr>
</table>
<h2>Business performance</h2>
<table>
<tr><th>${ex.perfKind === "year" ? "Year" : "Month"}</th><th>Purchases</th><th>Sales</th><th>Profit</th></tr>
${rows}
</table>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
