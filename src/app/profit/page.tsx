"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { type ColumnDef } from "@tanstack/react-table";
import { useStore, saleGrandTotal } from "@/lib/store";
import { Page, PageTitle, Tabs, CustomSelect, StatCard, Stagger, StaggerItem, EmptyState } from "@/components/ui";
import { fmtMoney, monthKey, monthLabel } from "@/lib/format";
import { DataTable } from "@/components/DataTable";
import CreditDebit from "@/components/CreditDebit";

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

type MonthRow = { label: string; revenue: number; cogs: number; expenses: number; net: number; margin: number };

const monthCols: ColumnDef<MonthRow>[] = [
  {
    accessorKey: "label",
    header: "Month",
    meta: { card: { position: "primary" } },
    cell: (c) => <span className="font-medium">{monthLabel(c.getValue<string>())}</span>,
  },
  {
    accessorKey: "revenue",
    header: "Revenue",
    meta: { hiddenOnMobile: true, align: "right" },
    cell: (c) => <span className="num">{fmtMoney(c.getValue<number>())}</span>,
  },
  {
    accessorKey: "cogs",
    header: "COGS",
    meta: { hiddenOnMobile: true, align: "right" },
    cell: (c) => <span className="num text-neutral-500">{fmtMoney(c.getValue<number>())}</span>,
  },
  {
    accessorKey: "expenses",
    header: "Expenses",
    meta: { hiddenOnMobile: true, align: "right" },
    cell: (c) => <span className="num text-neutral-500">{fmtMoney(c.getValue<number>())}</span>,
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

export default function ProfitLossPage() {
  const { sales, byItem, lineUnitCost, expenses, purchases } = useStore();
  const [mode, setMode] = useState<"all" | "month">("all");

  const allMonths = useMemo(() => {
    const keys = Array.from(
      new Set([...sales.map((s) => monthKey(s.date)), ...expenses.map((e) => monthKey(e.date)), ...purchases.map((p) => monthKey(p.date))])
    ).sort();
    return keys;
  }, [sales, expenses, purchases]);

  const [month, setMonth] = useState(() => allMonths[allMonths.length - 1] ?? "");

  const monthOptions = useMemo(
    () => allMonths.map((m) => ({ value: m, label: monthLabel(m) })),
    [allMonths]
  );

  const scoped = useMemo(() => {
    const ss = mode === "month" ? sales.filter((s) => monthKey(s.date) === month) : sales;
    const es = mode === "month" ? expenses.filter((e) => monthKey(e.date) === month) : expenses;
    const ps = mode === "month" ? purchases.filter((p) => monthKey(p.date) === month) : purchases;
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
    const totalExpenses = es.reduce((a, e) => a + e.amount, 0);
    const purchaseSpend = ps.reduce(
      (a, p) => a + p.qty * p.rate + p.transport + p.otherCost,
      0
    );
    return { revenue, cogs, totalExpenses, purchaseSpend, grossProfit: revenue - cogs, net: revenue - cogs - totalExpenses };
  }, [mode, month, sales, expenses, purchases, byItem, lineUnitCost]);

  const monthlyBreakdown = useMemo(() => {
    if (mode !== "month") return null;
    return allMonths.map((k) => {
      const ss = sales.filter((s) => monthKey(s.date) === k);
      const es = expenses.filter((e) => monthKey(e.date) === k);
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
      const net = revenue - cogs - exp;
      const margin = revenue > 0 ? (net / revenue) * 100 : 0;
      return { label: k, revenue, cogs, expenses: exp, net, margin };
    });
  }, [mode, allMonths, sales, expenses, byItem, lineUnitCost]);

  return (
    <Page>
      <PageTitle
        title="Profit & Loss"
        sub="How much money you made and what you spent"
        action={
          <div className="flex items-center gap-3">
            <Tabs
              tabs={[
                { key: "all", label: "All time" },
                { key: "month", label: "By month" },
              ]}
              value={mode}
              onChange={(k) => setMode(k as "all" | "month")}
            />
            {mode === "month" && (
              <CustomSelect
                value={month}
                onChange={setMonth}
                options={monthOptions}
                placeholder="Pick a month"
              />
            )}
          </div>
        }
      />

      {sales.length === 0 && expenses.length === 0 && purchases.length === 0 ? (
        <EmptyState
          emoji="📈"
          title="No numbers to crunch yet"
          hint="Profit & Loss wakes up as soon as you record your first purchase or sale."
          action={
            <Link href="/purchases" className="btn-primary">
              + Add Purchase
            </Link>
          }
        />
      ) : (
      <>
      {/* Summary cards */}
      <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StaggerItem><StatCard label="Money in (sales)" value={scoped.revenue} /></StaggerItem>
        <StaggerItem><StatCard label="Cost of stock sold" value={-scoped.cogs} /></StaggerItem>
        <StaggerItem><StatCard label="Shop expenses" value={-scoped.totalExpenses} /></StaggerItem>
        <StaggerItem><StatCard label="Profit left" value={scoped.net} invert={scoped.net > 0} /></StaggerItem>
      </Stagger>

      {/* P&L statement + Credit/Debit */}
      <div className="grid md:grid-cols-2 gap-10">
        <div>
          <h2 className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-4">
            {mode === "month" ? `Statement — ${monthLabel(month)}` : "All-time statement"}
          </h2>
          <div className="border border-neutral-200 p-4">
            <Row label="Revenue — from sales" value={scoped.revenue} />
            <Row label="Less — cost of stock sold (COGS)" value={scoped.cogs} minus />
            <Row label="Gross profit" value={scoped.grossProfit} strong />
            <Row label="Less — shop expenses" value={scoped.totalExpenses} minus />
            <div className="flex justify-between py-4 mt-1 bg-black text-white px-4 -mx-4">
              <span className="text-xs uppercase tracking-widest">Net profit</span>
              <motion.span
                key={scoped.net}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="tabular-nums text-lg font-medium"
              >
                {fmtMoney(scoped.net)}
              </motion.span>
            </div>
          </div>
          {scoped.revenue > 0 && (
            <p className="text-xs text-neutral-500 mt-3">
              On every ₨100 of sales you keep about ₨{((scoped.net / scoped.revenue) * 100).toFixed(0)} of profit.
            </p>
          )}
        </div>

        <div>
          <h2 className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-4">
            Credit &amp; Debit — who owes who
          </h2>
          <CreditDebit />
        </div>
      </div>

      {/* Monthly breakdown — only in monthly mode */}
      {mode === "month" && monthlyBreakdown && (
        <div className="mt-10">
          <h2 className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-4">
            Monthly breakdown
          </h2>
          <DataTable columns={monthCols} data={monthlyBreakdown} />
        </div>
      )}
      </>
      )}
    </Page>
  );
}
