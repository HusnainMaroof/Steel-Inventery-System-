"use client";

import { useMemo, useState } from "react";
import { useStore, saleTotal } from "@/lib/store";
import {
  Page,
  PageTitle,
  StatCard,
  Stagger,
  StaggerItem,
} from "@/components/ui";
import { fmtMoney } from "@/lib/format";

type Period = "today" | "monthly" | "yearly";

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
    for (const sale of pSales) {
      revenue += saleTotal(sale);
      for (const l of sale.lines) cogs += l.qty * (byItem[l.item] ?? 0);
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
      <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StaggerItem>
          <StatCard label="Stock on hand" value={stats.stockQty} money={false} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Stock value (landed)" value={stats.stockValue} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Revenue" value={periodStats.revenue} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Net profit" value={periodStats.netProfit} invert />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Gross profit" value={periodStats.grossProfit} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Customer dues" value={periodStats.customerDues} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Mill dues" value={periodStats.supplierDues} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Expenses" value={periodStats.expenses} />
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

