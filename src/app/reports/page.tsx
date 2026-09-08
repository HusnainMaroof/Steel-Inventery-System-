"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { useStore, purchaseTotal, saleGrandTotal } from "@/lib/store";
import { Page, PageTitle, Tabs, StatCard, Stagger, StaggerItem, EmptyState } from "@/components/ui";
import { fmtMoney, monthKey, monthLabel } from "@/lib/format";
import { DataTable } from "@/components/DataTable";
import CreditDebit from "@/components/CreditDebit";

type Row = {
  key: string; label: string;
  purchaseSpend: number;
  revenue: number; expenses: number; profit: number;
};

const monthCols: ColumnDef<Row>[] = [
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
    accessorKey: "profit",
    header: "Profit",
    meta: { align: "right", card: { position: "amount" } },
    cell: (c) => {
      const v = c.getValue<number>();
      return <span className={`num font-medium ${v < 0 ? "text-red-600" : ""}`}>{fmtMoney(v)}</span>;
    },
  },
];

export default function ReportsPage() {
  const { purchases, sales, expenses, inventory, byItem, lineUnitCost, customers, customerBalance, suppliers, supplierBalance } =
    useStore();
  const [tab, setTab] = useState<"monthly" | "yearly">("monthly");

  const allDates = useMemo(() => [
    ...purchases.map((p) => p.date),
    ...sales.map((s) => s.date),
    ...expenses.map((e) => e.date),
  ], [purchases, sales, expenses]);
  const year = useMemo(() => {
    if (allDates.length === 0) return String(new Date().getFullYear());
    const latest = allDates.sort().reverse()[0];
    return latest.slice(0, 4);
  }, [allDates]);

  const months = useMemo(
    () =>
      Array.from(
        new Set([
          ...purchases.map((p) => monthKey(p.date)),
          ...sales.map((s) => monthKey(s.date)),
          ...expenses.map((e) => monthKey(e.date)),
        ])
      ).sort().reverse(),
    [purchases, sales, expenses]
  );

  const rows = useMemo<Row[]>(
    () =>
      months.map((k) => {
        const ps = purchases.filter((p) => monthKey(p.date) === k);
        const ss = sales.filter((s) => monthKey(s.date) === k);
        const es = expenses.filter((e) => monthKey(e.date) === k);
        const purchaseSpend = ps.reduce((a, p) => a + purchaseTotal(p), 0);
        const revenue = ss.reduce((a, s) => a + saleGrandTotal(s), 0);
        const cogs = ss.reduce(
          (a, s) =>
            a +
            s.lines.reduce(
              (b, l, i) => b + l.qty * (lineUnitCost(s.id, i) || byItem[l.item] || 0),
              0
            ),
          0
        );
        const exp = es.reduce((a, e) => a + e.amount, 0);
        return {
          key: k,
          label: monthLabel(k),
          purchaseSpend,
          revenue,
          expenses: exp,
          profit: revenue - cogs - exp,
        };
      }),
    [months, purchases, sales, expenses, byItem, lineUnitCost]
  );

  const yearTotals = rows.reduce(
    (a, r) => ({
      purchaseSpend: a.purchaseSpend + r.purchaseSpend,
      revenue: a.revenue + r.revenue,
      expenses: a.expenses + r.expenses,
      profit: a.profit + r.profit,
    }),
    { purchaseSpend: 0, revenue: 0, expenses: 0, profit: 0 }
  );

  const receivable = customers.reduce((a, c) => a + Math.max(0, customerBalance(c.id)), 0);
  const payable = suppliers.reduce((a, s) => a + Math.max(0, supplierBalance(s.id)), 0);

  return (
    <Page>
      <PageTitle
        title="Reports"
        sub="A simple summary of every month and the whole year"
        action={
          <Tabs
            tabs={[
              { key: "monthly", label: "Monthly" },
              { key: "yearly", label: "Yearly" },
            ]}
            value={tab}
            onChange={(k) => setTab(k as "monthly" | "yearly")}
          />
        }
      />

      {months.length === 0 ? (
        <EmptyState
          emoji="🗓️"
          title="Nothing to report yet"
          hint="Reports fill themselves in as you record purchases, sales and expenses."
          action={
            <Link href="/purchases" className="btn-primary">
              + Add Purchase
            </Link>
          }
        />
      ) : (
      <>
      {/* Summary cards */}
      <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StaggerItem><StatCard label={`Money in (${year})`} value={yearTotals.revenue} /></StaggerItem>
        <StaggerItem><StatCard label="Stock purchased" value={-yearTotals.purchaseSpend} /></StaggerItem>
        <StaggerItem><StatCard label="Profit left" value={yearTotals.profit} invert={yearTotals.profit > 0} /></StaggerItem>
        <StaggerItem><StatCard label="Stock in shop (worth)" value={inventory.reduce((a, r) => a + r.stockValue, 0)} /></StaggerItem>
      </Stagger>

      {tab === "monthly" ? (
        <div className="grid md:grid-cols-2 gap-10">
          {/* Monthly table */}
          <div>
            <h2 className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-4">
              Month-by-month — {year}
            </h2>
            <DataTable columns={monthCols} data={rows} />
          </div>

          {/* Credit & Debit */}
          <div>
            <h2 className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-4">
              Credit &amp; Debit — who owes who
            </h2>
            <CreditDebit />
          </div>
        </div>
      ) : (
        /* Yearly summary */
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

          {/* Credit & Debit */}
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
