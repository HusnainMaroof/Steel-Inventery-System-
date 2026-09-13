"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { type ColumnDef } from "@tanstack/react-table";
import { useStore, purchaseTotal, saleTotal, saleGrandTotal } from "@/lib/store";
import { Page, PageTitle, Tabs, CustomSelect, StatCard, Stagger, StaggerItem, EmptyState } from "@/components/ui";
import { fmtMoney, monthKey, monthLabel } from "@/lib/format";
import { DataTable } from "@/components/DataTable";
import CreditDebit from "@/components/CreditDebit";

/* ------------------------------------------------------------------ */
/* shared statement row (used by the P&L statement)                    */
/* ------------------------------------------------------------------ */
function Row({
  label,
  value,
  strong,
  minus,
}: {
  label: string;
  value: number;
  strong?: boolean;
  minus?: boolean;
}) {
  return (
    <div className={`flex justify-between py-3 border-b border-neutral-200 ${strong ? "font-medium" : ""}`}>
      <span className={strong ? "" : "text-neutral-600"}>{label}</span>
      <motion.span
        key={label + value}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        className="tabular-nums"
      >
        {minus ? "− " : ""}{fmtMoney(value)}
      </motion.span>
    </div>
  );
}

/* one row per month, computed once and shared by both tabs */
type MonthStat = {
  key: string;
  label: string;
  purchaseCount: number; // how many purchase lots were made
  purchaseSpend: number;
  revenue: number;
  cogs: number;
  gross: number; // revenue − cogs (profit before any other costs)
  expenses: number;
  net: number;
  margin: number;
};

/* resolve which Product a record belongs to (category → product,
   variant → category → product, or legacy item-name map) — works for
   both sale lines and purchase lots */
const recordProductId = (
  r: { categoryId?: string; variantId?: string; item: string },
  varCat: Map<string, string>,
  catProd: Map<string, string>,
  itemProd: Map<string, string>
) =>
  (r.categoryId && catProd.get(r.categoryId)) ||
  (r.variantId && catProd.get(varCat.get(r.variantId) ?? "")) ||
  itemProd.get(r.item) ||
  "";

/* P&L monthly breakdown columns */
const pnlMonthCols: ColumnDef<MonthStat>[] = [
  {
    accessorKey: "label",
    header: "Month",
    meta: { card: { position: "primary" } },
    cell: (c) => <span className="font-medium">{c.getValue<string>()}</span>,
  },
  {
    accessorKey: "purchaseCount",
    header: "Purchases",
    meta: { hiddenOnMobile: true, align: "right" },
    cell: (c) => <span className="num text-neutral-500">{c.getValue<number>()}</span>,
  },
  {
    accessorKey: "revenue",
    header: "Revenue",
    meta: { hiddenOnMobile: true, align: "right" },
    cell: (c) => <span className="num">{fmtMoney(c.getValue<number>())}</span>,
  },
  {
    accessorKey: "cogs",
    header: "Stock cost",
    meta: { hiddenOnMobile: true, align: "right" },
    cell: (c) => <span className="num text-neutral-500">{fmtMoney(c.getValue<number>())}</span>,
  },
  {
    accessorKey: "gross",
    header: "Profit",
    meta: { align: "right", card: { position: "amount" } },
    cell: (c) => {
      const v = c.getValue<number>();
      return <span className={`num font-medium ${v < 0 ? "text-red-600" : ""}`}>{fmtMoney(v)}</span>;
    },
  },
  {
    accessorKey: "margin",
    header: "Margin",
    meta: { align: "right", card: { position: "badge" } },
    cell: (c) => {
      const { margin, revenue } = c.row.original;
      return (
        <span className={`num ${margin < 0 ? "text-red-600" : "text-neutral-500"}`}>
          {revenue > 0 ? `${margin.toFixed(0)}%` : "—"}
        </span>
      );
    },
  },
];

/* Summary tab month-by-month columns */
const summaryMonthCols: ColumnDef<MonthStat>[] = [
  {
    accessorKey: "label",
    header: "Month",
    meta: { card: { position: "primary" } },
    cell: (c) => <span className="font-medium">{c.getValue<string>()}</span>,
  },
  {
    accessorKey: "purchaseSpend",
    header: "Spent",
    meta: { hiddenOnMobile: true, align: "right" },
    cell: (c) => <span className="num">{fmtMoney(c.getValue<number>())}</span>,
  },
  {
    accessorKey: "revenue",
    header: "Money in",
    meta: { hiddenOnMobile: true, align: "right" },
    cell: (c) => <span className="num">{fmtMoney(c.getValue<number>())}</span>,
  },
  {
    accessorKey: "expenses",
    header: "Expenses",
    meta: { hiddenOnMobile: true, align: "right" },
    cell: (c) => <span className="num">{fmtMoney(c.getValue<number>())}</span>,
  },
  {
    accessorKey: "net",
    header: "Profit",
    meta: { align: "right", card: { position: "amount" } },
    cell: (c) => {
      const v = c.getValue<number>();
      return <span className={`num font-medium ${v < 0 ? "text-red-600" : ""}`}>{fmtMoney(v)}</span>;
    },
  },
];

export default function ReportsPage() {
  const {
    purchases,
    sales,
    expenses,
    inventory,
    byItem,
    lineUnitCost,
    salePaid,
    customers,
    customerBalance,
    suppliers,
    supplierBalance,
    products,
    categories,
    variants,
    productItems,
  } = useStore();

  /* outer: which combined view */
  const [view, setView] = useState<"pnl" | "summary">("pnl");

  /* P&L tab controls */
  const [pnlMode, setPnlMode] = useState<"all" | "month">("all");
  const [productFilter, setProductFilter] = useState<string>("");

  /* Summary tab controls */
  const [repTab, setRepTab] = useState<"monthly" | "yearly">("monthly");

  /* resolve which Product a record belongs to (category → product,
     variant → category → product, or legacy item-name map) — works for
     both sale lines and purchase lots */
  const productMaps = useMemo(
    () => ({
      varCat: new Map(variants.map((v) => [v.id, v.categoryId])),
      catProd: new Map(categories.map((c) => [c.id, c.productId])),
      itemProd: new Map(productItems.map((it) => [it.name, it.productId])),
    }),
    [variants, categories, productItems]
  );
  const productOf = useCallback(
    (r: { categoryId?: string; variantId?: string; item: string }) =>
      recordProductId(r, productMaps.varCat, productMaps.catProd, productMaps.itemProd),
    [productMaps]
  );

  const productOptions = useMemo(
    () => [{ value: "", label: "All products" }, ...products.map((p) => ({ value: p.id, label: p.name }))],
    [products]
  );
  const productName = products.find((p) => p.id === productFilter)?.name;

  const monthStats = useMemo<MonthStat[]>(() => {
    const keys = Array.from(
      new Set([
        ...purchases.map((p) => monthKey(p.date)),
        ...sales.map((s) => monthKey(s.date)),
        ...expenses.map((e) => monthKey(e.date)),
      ])
    ).sort();
    return keys.map((k) => {
      const ps = purchases.filter(
        (p) => monthKey(p.date) === k && (!productFilter || productOf(p) === productFilter)
      );
      const ss = sales.filter((s) => monthKey(s.date) === k);
      const es = productFilter ? [] : expenses.filter((e) => monthKey(e.date) === k);
      const purchaseSpend = ps.reduce((a, p) => a + purchaseTotal(p), 0);
      /* per-product revenue attributes each invoice's discount/tax/charges
         across its lines in proportion to their share of the subtotal */
      const revenue = ss.reduce((a, s) => {
        const sub = saleTotal(s);
        const grand = saleGrandTotal(s);
        return (
          a +
          s.lines.reduce((b, l) => {
            if (productFilter && productOf(l) !== productFilter) return b;
            return b + (sub > 0 ? (l.qty * l.rate * grand) / sub : 0);
          }, 0)
        );
      }, 0);
      const cogs = ss.reduce(
        (a, s) =>
          a +
          s.lines.reduce((b, l, i) => {
            if (productFilter && productOf(l) !== productFilter) return b;
            return b + l.qty * (lineUnitCost(s.id, i) || byItem[l.item] || 0);
          }, 0),
        0
      );
      const expensesSum = es.reduce((a, e) => a + e.amount, 0);
      const net = revenue - cogs - expensesSum;
      return {
        key: k,
        label: monthLabel(k),
        purchaseCount: ps.length,
        purchaseSpend,
        revenue,
        cogs,
        gross: revenue - cogs,
        expenses: expensesSum,
        net,
        margin: revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0,
      };
    });
  }, [purchases, sales, expenses, byItem, lineUnitCost, productFilter, productOf]);

  /* P&L tab state — month defaults to the most recent month */
  const [month, setMonth] = useState<string>(() => "");
  const hasAny = purchases.length > 0 || sales.length > 0 || expenses.length > 0;
  const monthOptions = useMemo(
    () => monthStats.map((m) => ({ value: m.key, label: m.label })),
    [monthStats]
  );
  /* initialise the picker once the first data is present */
  const effectiveMonth = month || monthStats[monthStats.length - 1]?.key || "";
  const scoped = useMemo(() => {
    const target = monthStats.find((m) => m.key === effectiveMonth);
    if (pnlMode === "month" && target) return target;
    return monthStats.reduce(
      (a, m) => ({
        purchaseCount: a.purchaseCount + m.purchaseCount,
        purchaseSpend: a.purchaseSpend + m.purchaseSpend,
        revenue: a.revenue + m.revenue,
        cogs: a.cogs + m.cogs,
        gross: a.gross + m.gross,
        expenses: a.expenses + m.expenses,
        net: a.net + m.net,
        margin: 0,
      }),
      { purchaseCount: 0, purchaseSpend: 0, revenue: 0, cogs: 0, gross: 0, expenses: 0, net: 0, margin: 0 }
    );
  }, [monthStats, pnlMode, effectiveMonth]);

  /* Dues shown on the P&L tab — shop-wide totals, or scoped to the
     selected product (each invoice/lot's dues attributed by its share) */
  const pnlDues = useMemo(() => {
    if (!productFilter) {
      return {
        receivable: customers.reduce((a, c) => a + Math.max(0, customerBalance(c.id)), 0),
        payable: suppliers.reduce((a, s) => a + Math.max(0, supplierBalance(s.id)), 0),
      };
    }
    const receivable = sales.reduce((a, s) => {
      const sub = saleTotal(s);
      const sold = s.lines.reduce(
        (b, l) => (productOf(l) === productFilter ? b + l.qty * l.rate : b),
        0
      );
      if (sold <= 0 || sub <= 0) return a;
      const share = sold / sub;
      return a + share * Math.max(0, saleGrandTotal(s) - salePaid(s.id));
    }, 0);
    const payable = purchases.reduce(
      (a, p) =>
        productOf(p) === productFilter ? a + Math.max(0, purchaseTotal(p) - (p.paid ?? 0)) : a,
      0
    );
    return { receivable, payable };
  }, [productFilter, customers, customerBalance, suppliers, supplierBalance, sales, purchases, salePaid, productOf]);

  /* Summary tab aggregates */
  const year = useMemo(() => {
    if (monthStats.length === 0) return String(new Date().getFullYear());
    return monthStats[monthStats.length - 1].key.slice(0, 4);
  }, [monthStats]);

  const yearTotals = useMemo(
    () =>
      monthStats.reduce(
        (a, m) => ({
          purchaseSpend: a.purchaseSpend + m.purchaseSpend,
          revenue: a.revenue + m.revenue,
          expenses: a.expenses + m.expenses,
          profit: a.profit + m.net,
        }),
        { purchaseSpend: 0, revenue: 0, expenses: 0, profit: 0 }
      ),
    [monthStats]
  );

  const receivable = customers.reduce((a, c) => a + Math.max(0, customerBalance(c.id)), 0);
  const payable = suppliers.reduce((a, s) => a + Math.max(0, supplierBalance(s.id)), 0);
  const stockWorth = inventory.reduce((a, r) => a + r.stockValue, 0);

  return (
    <Page>
      <PageTitle
        title="Reports & Profit"
        sub="Your profit statement and the month-by-month summary in one place"
        action={
          <Tabs
            tabs={[
              { key: "pnl", label: "Profit & Loss" },
              { key: "summary", label: "Summary" },
            ]}
            value={view}
            onChange={(k) => setView(k as "pnl" | "summary")}
          />
        }
      />

      {!hasAny ? (
        <EmptyState
          emoji="📈"
          title="No numbers to crunch yet"
          hint="Profit and reports wake up as soon as you record your first purchase, sale or expense."
          action={
            <Link href="/purchases" className="btn-primary">
              + Add Purchase
            </Link>
          }
        />
      ) : view === "pnl" ? (
        <>
          {/* P&L scope controls — all filters on one row */}
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <Tabs
              tabs={[
                { key: "all", label: "All time" },
                { key: "month", label: "By month" },
              ]}
              value={pnlMode}
              onChange={(k) => setPnlMode(k as "all" | "month")}
            />
            {pnlMode === "month" && monthOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">Month</span>
                <CustomSelect
                  value={effectiveMonth}
                  onChange={setMonth}
                  options={monthOptions}
                  placeholder="Pick a month"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">Product</span>
              <CustomSelect
                value={productFilter}
                onChange={setProductFilter}
                options={productOptions}
                placeholder="All products"
              />
            </div>
          </div>

          {/* Summary cards */}
          <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <StaggerItem><StatCard label="Money in (sales)" value={scoped.revenue} /></StaggerItem>
            <StaggerItem><StatCard label="Purchases made" value={scoped.purchaseCount} money={false} /></StaggerItem>
            <StaggerItem><StatCard label="Spent on stock" value={scoped.purchaseSpend} /></StaggerItem>
            <StaggerItem><StatCard label="Profit left" value={scoped.gross} invert={scoped.gross > 0} /></StaggerItem>
          </Stagger>

          {/* P&L statement + Credit/Debit */}
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <h2 className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-4">
                {pnlMode === "month"
                  ? `Statement — ${productName ? `${productName} — ` : ""}${monthLabel(effectiveMonth)}`
                  : productName
                    ? `Statement — ${productName} — All time`
                    : "All-time statement"}
              </h2>
              <div className="border border-neutral-200 p-4">
                <Row label="Money from sales" value={scoped.revenue} />
                <Row label="Less — cost of stock you sold" value={scoped.cogs} minus />
                <div className="flex justify-between py-4 mt-1 bg-black text-white px-4 -mx-4">
                  <span className="text-xs uppercase tracking-widest">Profit</span>
                  <motion.span
                    key={scoped.gross}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="tabular-nums text-lg font-medium"
                  >
                    {fmtMoney(scoped.gross)}
                  </motion.span>
                </div>
              </div>
              {scoped.purchaseSpend > 0 && (
                <p className="text-xs text-neutral-500 mt-3">
                  You also spent {fmtMoney(scoped.purchaseSpend)} buying stock in this period.
                </p>
              )}
              {scoped.revenue > 0 && (
                <p className="text-xs text-neutral-500 mt-3">
                  On every ₨100 of sales you keep about ₨{((scoped.gross / scoped.revenue) * 100).toFixed(0)} of profit.
                </p>
              )}
            </div>

            <div>
              <h2 className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-4">
                Credit &amp; Debit — total dues
              </h2>
              <CreditDebit showWho={false} receivable={pnlDues.receivable} payable={pnlDues.payable} />
            </div>
          </div>

          {/* Monthly breakdown — only in By month mode */}
          {pnlMode === "month" && (
            <div className="mt-10">
              <h2 className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-4">
                Monthly breakdown
              </h2>
              <DataTable columns={pnlMonthCols} data={monthStats} />
            </div>
          )}
        </>
      ) : (
        <>
          {/* Summary tab scope controls */}
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <Tabs
              tabs={[
                { key: "monthly", label: "Monthly" },
                { key: "yearly", label: "Yearly" },
              ]}
              value={repTab}
              onChange={(k) => setRepTab(k as "monthly" | "yearly")}
            />
          </div>

          {/* Summary cards */}
          <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <StaggerItem><StatCard label={`Money in (${year})`} value={yearTotals.revenue} /></StaggerItem>
            <StaggerItem><StatCard label="Stock purchased" value={-yearTotals.purchaseSpend} /></StaggerItem>
            <StaggerItem><StatCard label="Profit left" value={yearTotals.profit} invert={yearTotals.profit > 0} /></StaggerItem>
            <StaggerItem><StatCard label="Stock in shop (worth)" value={stockWorth} /></StaggerItem>
          </Stagger>

          {repTab === "monthly" ? (
            <div className="grid md:grid-cols-2 gap-10">
              <div>
                <h2 className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-4">
                  Month-by-month — {year}
                </h2>
                <DataTable columns={summaryMonthCols} data={[...monthStats].reverse()} />
              </div>
              <div>
                <h2 className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-4">
                  Credit &amp; Debit — who owes who
                </h2>
                <CreditDebit />
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-10">
              <div>
                <h2 className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-4">
                  Year summary — {year}
                </h2>
                <div className="border border-neutral-200">
                  {[
                    { label: "Money spent on stock (incl. transport)", value: yearTotals.purchaseSpend, minus: true },
                    { label: "Money received from sales", value: yearTotals.revenue },
                    { label: "Shop expenses", value: yearTotals.expenses, minus: true },
                  ].map((r) => (
                    <div key={r.label} className="flex justify-between py-3 border-b border-neutral-200 px-4">
                      <span className="text-neutral-600 text-sm">{r.label}</span>
                      <span className="tabular-nums text-sm">{r.minus ? "− " : ""}{fmtMoney(r.value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-4 bg-black text-white px-4">
                    <span className="text-xs uppercase tracking-widest">Profit left</span>
                    <span className="tabular-nums text-lg font-medium">{fmtMoney(yearTotals.profit)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="border border-neutral-200 p-4">
                    <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Customers owe you</span>
                    <span className="block text-xl font-medium tabular-nums mt-1">{fmtMoney(receivable)}</span>
                  </div>
                  <div className="border border-neutral-200 p-4">
                    <span className="block text-[11px] uppercase tracking-widest text-neutral-500">You owe suppliers</span>
                    <span className="block text-xl font-medium tabular-nums mt-1">{fmtMoney(payable)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-4">
                  Credit &amp; Debit — who owes who
                </h2>
                <CreditDebit />
              </div>
            </div>
          )}
        </>
      )}
    </Page>
  );
}
