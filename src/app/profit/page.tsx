"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useStore, saleTotal } from "@/lib/store";
import { Page, PageTitle, BarChart } from "@/components/ui";
import { fmtMoney, monthKey, monthLabel } from "@/lib/format";

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

export default function ProfitLossPage() {
  const { sales, byItem, expenses, purchases } = useStore();
  const [mode, setMode] = useState<"all" | "month">("all");
  const [month, setMonth] = useState(
    Object.keys(
      sales.reduce((m, s) => ({ ...m, [monthKey(s.date)]: true }), {})
    ).sort().pop() ?? ""
  );

  const scoped = useMemo(() => {
    const ss = mode === "month" ? sales.filter((s) => monthKey(s.date) === month) : sales;
    const es = mode === "month" ? expenses.filter((e) => monthKey(e.date) === month) : expenses;
    const ps = mode === "month" ? purchases.filter((p) => monthKey(p.date) === month) : purchases;
    const revenue = ss.reduce((a, s) => a + saleTotal(s), 0);
    const cogs = ss.reduce(
      (a, s) => a + s.lines.reduce((b, l) => b + l.qty * (byItem[l.item] ?? 0), 0),
      0
    );
    const totalExpenses = es.reduce((a, e) => a + e.amount, 0);
    const purchaseSpend = ps.reduce(
      (a, p) => a + p.qty * p.rate + p.transport + p.otherCost,
      0
    );
    return { revenue, cogs, totalExpenses, purchaseSpend, grossProfit: revenue - cogs, net: revenue - cogs - totalExpenses };
  }, [mode, month, sales, expenses, purchases, byItem]);

  const months = useMemo(() => {
    const keys = Array.from(
      new Set([...sales.map((s) => monthKey(s.date)), ...expenses.map((e) => monthKey(e.date))])
    ).sort();
    return keys.map((k) => {
      const ss = sales.filter((s) => monthKey(s.date) === k);
      const es = expenses.filter((e) => monthKey(e.date) === k);
      const revenue = ss.reduce((a, s) => a + saleTotal(s), 0);
      const cogs = ss.reduce(
        (a, s) => a + s.lines.reduce((b, l) => b + l.qty * (byItem[l.item] ?? 0), 0),
        0
      );
      const exp = es.reduce((a, e) => a + e.amount, 0);
      return { label: k, revenue, net: revenue - cogs - exp };
    });
  }, [sales, expenses, byItem]);

  return (
    <Page>
      <PageTitle
        title="Profit & Loss"
        sub="Based on actual landed cost — not just the mill price"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setMode("all")}
              className={mode === "all" ? "btn-primary" : "btn-ghost"}
            >
              All time
            </button>
            <button
              onClick={() => setMode("month")}
              className={mode === "month" ? "btn-primary" : "btn-ghost"}
            >
              By month
            </button>
            {mode === "month" && (
              <select
                className="w-40 sm:w-44"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                {months.map((m) => (
                  <option key={m.label} value={m.label}>{monthLabel(m.label)}</option>
                ))}
              </select>
            )}
          </div>
        }
      />

      <div className="grid md:grid-cols-2 gap-10">
        <div>
          <Row label="Sales revenue" value={scoped.revenue} />
          <Row label="Cost of goods sold (landed)" value={scoped.cogs} minus />
          <Row label="Gross profit" value={scoped.grossProfit} strong />
          <Row label="Operating expenses" value={scoped.totalExpenses} minus />
          <div className="flex justify-between py-4 mt-2 bg-black text-white px-4 -mx-4">
            <span className="text-xs uppercase tracking-widest">Net profit</span>
            <motion.span
              key={scoped.net}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="tabular-nums text-lg"
            >
              {fmtMoney(scoped.net)}
            </motion.span>
          </div>
          <p className="text-xs text-neutral-500 mt-4">
            Margin: {scoped.revenue > 0 ? ((scoped.grossProfit / scoped.revenue) * 100).toFixed(1) : "0"}% gross ·
            Total purchase spend in period: {fmtMoney(scoped.purchaseSpend)}
          </p>
        </div>
        <div>
          <h2 className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-4">
            Net profit by month
          </h2>
          <BarChart data={months.map((m) => ({ label: monthLabel(m.label).slice(0, 3), value: Math.max(0, m.net) }))} />
          <table className="mt-6">
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Revenue</th>
                <th className="num">Net</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.label}>
                  <td>{monthLabel(m.label)}</td>
                  <td className="num">{fmtMoney(m.revenue)}</td>
                  <td className="num">{fmtMoney(m.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Page>
  );
}
