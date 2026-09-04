"use client";

import { useMemo, useState } from "react";
import { useStore, purchaseTotal, saleTotal } from "@/lib/store";
import { Page, PageTitle, StatCard, Stagger, StaggerItem } from "@/components/ui";
import { fmtMoney, fmtQty, monthKey, monthLabel } from "@/lib/format";

type Row = {
  key: string; label: string;
  purchasedQty: number; purchaseSpend: number;
  soldQty: number; revenue: number; expenses: number; profit: number;
};

export default function ReportsPage() {
  const { purchases, sales, expenses, inventory, byItem, customers, customerBalance, suppliers, supplierBalance } =
    useStore();
  const [tab, setTab] = useState<"monthly" | "yearly">("monthly");
  const year = "2026";

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
        const revenue = ss.reduce((a, s) => a + saleTotal(s), 0);
        const cogs = ss.reduce(
          (a, s) => a + s.lines.reduce((b, l) => b + l.qty * (byItem[l.item] ?? 0), 0),
          0
        );
        const exp = es.reduce((a, e) => a + e.amount, 0);
        return {
          key: k,
          label: monthLabel(k),
          purchasedQty: ps.reduce((a, p) => a + p.qty, 0),
          purchaseSpend,
          soldQty: ss.reduce((a, s) => a + s.lines.reduce((b, l) => b + l.qty, 0), 0),
          revenue,
          expenses: exp,
          profit: revenue - cogs - exp,
        };
      }),
    [months, purchases, sales, expenses, byItem]
  );

  const yearTotals = rows.reduce(
    (a, r) => ({
      purchasedQty: a.purchasedQty + r.purchasedQty,
      purchaseSpend: a.purchaseSpend + r.purchaseSpend,
      soldQty: a.soldQty + r.soldQty,
      revenue: a.revenue + r.revenue,
      expenses: a.expenses + r.expenses,
      profit: a.profit + r.profit,
    }),
    { purchasedQty: 0, purchaseSpend: 0, soldQty: 0, revenue: 0, expenses: 0, profit: 0 }
  );

  const receivable = customers.reduce((a, c) => a + Math.max(0, customerBalance(c.id)), 0);
  const payable = suppliers.reduce((a, s) => a + Math.max(0, supplierBalance(s.id)), 0);

  return (
    <Page>
      <PageTitle
        title="Reports"
        sub="Monthly & yearly summaries for audit"
        action={
          <div className="flex gap-2">
            <button onClick={() => setTab("monthly")} className={tab === "monthly" ? "btn-primary" : "btn-ghost"}>Monthly</button>
            <button onClick={() => setTab("yearly")} className={tab === "yearly" ? "btn-primary" : "btn-ghost"}>Yearly</button>
          </div>
        }
      />
      <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StaggerItem><StatCard label={`Year ${year} revenue`} value={yearTotals.revenue} /></StaggerItem>
        <StaggerItem><StatCard label="Yearly purchases" value={yearTotals.purchaseSpend} /></StaggerItem>
        <StaggerItem><StatCard label="Yearly net profit" value={yearTotals.profit} /></StaggerItem>
        <StaggerItem><StatCard label="Stock value (closing)" value={inventory.reduce((a, r) => a + r.stockValue, 0)} /></StaggerItem>
      </Stagger>
      {tab === "monthly" ? (
        <div className="border border-neutral-200 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Month</th><th className="num">Bought (t)</th><th className="num">Purchases</th>
                <th className="num">Sold (t)</th><th className="num">Sales</th>
                <th className="num">Expenses</th><th className="num">Net profit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="font-medium">{r.label}</td>
                  <td className="num">{fmtQty(r.purchasedQty)}</td>
                  <td className="num">{fmtMoney(r.purchaseSpend)}</td>
                  <td className="num">{fmtQty(r.soldQty)}</td>
                  <td className="num">{fmtMoney(r.revenue)}</td>
                  <td className="num">{fmtMoney(r.expenses)}</td>
                  <td className="num font-medium">{fmtMoney(r.profit)}</td>
                </tr>
              ))}
              <tr className="font-medium bg-neutral-50">
                <td>Year {year}</td>
                <td className="num">{fmtQty(yearTotals.purchasedQty)}</td>
                <td className="num">{fmtMoney(yearTotals.purchaseSpend)}</td>
                <td className="num">{fmtQty(yearTotals.soldQty)}</td>
                <td className="num">{fmtMoney(yearTotals.revenue)}</td>
                <td className="num">{fmtMoney(yearTotals.expenses)}</td>
                <td className="num">{fmtMoney(yearTotals.profit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-neutral-200 overflow-x-auto">
          <table>
            <thead><tr><th>Summary — Year {year}</th><th className="num">Amount</th></tr></thead>
            <tbody>
              <tr><td>Total steel purchased</td><td className="num">{fmtQty(yearTotals.purchasedQty)}</td></tr>
              <tr><td>Total purchase spend (landed)</td><td className="num">{fmtMoney(yearTotals.purchaseSpend)}</td></tr>
              <tr><td>Total steel sold</td><td className="num">{fmtQty(yearTotals.soldQty)}</td></tr>
              <tr><td>Total sales revenue</td><td className="num">{fmtMoney(yearTotals.revenue)}</td></tr>
              <tr><td>Operating expenses</td><td className="num">{fmtMoney(yearTotals.expenses)}</td></tr>
              <tr className="font-medium"><td>Net profit (landed-cost basis)</td><td className="num">{fmtMoney(yearTotals.profit)}</td></tr>
              <tr><td>Customer dues (receivable)</td><td className="num">{fmtMoney(receivable)}</td></tr>
              <tr><td>Mill dues (payable)</td><td className="num">{fmtMoney(payable)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
