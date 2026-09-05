"use client";

import { useMemo, useState } from "react";
import { useStore, saleTotal } from "@/lib/store";
import {
  Page,
  PageTitle,
  Stagger,
  StaggerItem,
} from "@/components/ui";
import { fmtMoney, fmtQty } from "@/lib/format";

type Period = "today" | "monthly" | "yearly";

// combined stat card: two related figures stacked in one box
function StatBox({
  rows,
}: {
  rows: { label: string; value: string; invert?: boolean }[];
}) {
  return (
    <div className="border border-neutral-200 bg-white p-4 sm:p-5">
      {rows.map((r, i) => (
        <div key={r.label} className={i > 0 ? "mt-4 pt-4 border-t border-neutral-200" : ""}>
          <p className="text-sm uppercase tracking-wider text-neutral-900 font-medium mb-1">
            {r.label}
          </p>
          <p
            className={`text-2xl font-medium tabular-nums ${
              r.invert ? "inline-block bg-black text-white px-2 py-0.5" : ""
            }`}
          >
            {r.value}
          </p>
        </div>
      ))}
    </div>
  );
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

const inPeriod = (date: string, period: Period) => {
  const now = new Date();
  const d = new Date(date);
  if (period === "today")
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  if (period === "monthly")
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  return d.getFullYear() === now.getFullYear();
};

export default function DashboardPage() {
  const {
    stats, customers, customerBalance, suppliers, supplierBalance,
    sales, payments, expenses, byItem,
  } = useStore();
  const [period, setPeriod] = useState<Period>("monthly");

  const periodStats = useMemo(() => {
    const pSales = sales.filter((x) => inPeriod(x.date, period));
    const pPayments = payments.filter((x) => inPeriod(x.date, period));
    const pExpenses = expenses.filter((x) => inPeriod(x.date, period));

    let revenue = 0;
    let cogs = 0;
    let soldQty = 0;
    for (const sale of pSales) {
      revenue += saleTotal(sale);
      for (const l of sale.lines) {
        cogs += l.qty * (byItem[l.item] ?? 0);
        soldQty += l.qty;
      }
    }
    const totalExpenses = pExpenses.reduce((a, e) => a + e.amount, 0);
    const grossProfit = revenue - cogs;

    const dues = new Map<string, number>();
    for (const sale of pSales)
      dues.set(sale.customerId, (dues.get(sale.customerId) ?? 0) + saleTotal(sale));
    for (const p of pPayments)
      if (p.type === "customer")
        dues.set(p.partyId, (dues.get(p.partyId) ?? 0) - p.amount);
    const customerDues = [...dues.values()].reduce((a, v) => a + Math.max(0, v), 0);

    const payable = new Map<string, number>();
    for (const p of pPayments)
      if (p.type === "supplier")
        payable.set(p.partyId, (payable.get(p.partyId) ?? 0) - p.amount);
    const supplierDues = [...payable.values()].reduce((a, v) => a + Math.max(0, -v), 0);

    return {
      revenue, grossProfit, expenses: totalExpenses,
      netProfit: grossProfit - totalExpenses,
      soldQty,
      customerDues, supplierDues,
    };
  }, [sales, payments, expenses, byItem, period]);

  const topCustomers = customers
    .map((c) => ({ ...c, bal: customerBalance(c.id) }))
    .sort((a, b) => b.bal - a.bal)
    .slice(0, 4);

  return (
    <Page>
      <PageTitle
        title="Dashboard"
        action={
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={period === p.key ? "btn-primary" : "btn-ghost"}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />
      <Stagger className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StaggerItem>
          <StatBox
            rows={[
              { label: "Stock Available", value: `${stats.stockQty} t` },
              { label: "Stock Worth", value: fmtMoney(stats.stockValue) },
            ]}
          />
        </StaggerItem>
        <StaggerItem>
          <StatBox
            rows={[
              { label: "Total Sales", value: fmtMoney(periodStats.revenue) },
              { label: "Steel Sold", value: `${fmtQty(periodStats.soldQty)}` },
              { label: "Your Profit", value: fmtMoney(periodStats.netProfit), invert: true },
            ]}
          />
        </StaggerItem>
        <StaggerItem>
          <StatBox
            rows={[
              { label: "Customer Payments Due", value: fmtMoney(periodStats.customerDues) },
              { label: "Supplier Payments Due", value: fmtMoney(periodStats.supplierDues) },
            ]}
          />
        </StaggerItem>
      </Stagger>

      <div className="grid md:grid-cols-2 gap-8 mt-10">
        <div>
          <h2 className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-4">
            Top customer balances
          </h2>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.name}
                    <span className="text-neutral-400 text-xs ml-2">{c.shop}</span>
                  </td>
                  <td className="num">
                    {c.bal > 0 ? (
                      <span className="hl">owes {fmtMoney(c.bal)}</span>
                    ) : (
                      <span className="text-neutral-500">
                        advance {fmtMoney(-c.bal)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-4">
            Outstanding to mills
          </h2>
          <table>
            <tbody>
              {suppliers.map((sp) => (
                <tr key={sp.id}>
                  <td>{sp.name}</td>
                  <td className="num">
                    {supplierBalance(sp.id) > 0 ? (
                      <span className="hl">{fmtMoney(supplierBalance(sp.id))}</span>
                    ) : (
                      fmtMoney(0)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Page>
  );
}

