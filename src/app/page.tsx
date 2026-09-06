"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore, saleTotal, steelAmount } from "@/lib/store";
import { Page, Stagger, StaggerItem, CountUp } from "@/components/ui";
import { fmtMoney, fmtCompact, fmtDate } from "@/lib/format";

type Period = "today" | "monthly" | "yearly";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "monthly", label: "This Month" },
  { key: "yearly", label: "This Year" },
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

const sortBy = <T,>(arr: T[], key: (x: T) => number) =>
  [...arr].sort((a, b) => key(b) - key(a));

/* ---------- shared primitives (monochrome, 8px radius) ---------- */

function Card({
  children,
  dark = false,
  className = "",
}: {
  children: React.ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`panel overflow-hidden ${
        dark ? "!bg-[#111] !border-[#111]" : "bg-white"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* Section header used inside every card: uppercase, 500–600, letter-spaced */
function SectionTitle({
  children,
  action,
  dark = false,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-100">
      <h2
        className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
          dark ? "text-neutral-400" : "text-neutral-500"
        }`}
      >
        {children}
      </h2>
      {action}
    </div>
  );
}

function ViewAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="text-xs font-medium underline underline-offset-4 text-neutral-500 hover:text-neutral-900 transition-colors"
    >
      View all →
    </Link>
  );
}

/* status badges — muted green/red, only for state */
function Badge({ tone, children }: { tone: "pos" | "neg"; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md border ${
        tone === "pos"
          ? "text-[#3f6212] bg-[#f7f7f2] border-[#e5e5e0]"
          : "text-[#b3261e] bg-[#fdf6f5] border-[#f0e0de]"
      }`}
    >
      {children}
    </span>
  );
}

/* KPI figure: strong 700 number, optional unit suffix */
function KpiNumber({
  value,
  prefix = "",
  suffix = "",
  compact = true,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  compact?: boolean;
}) {
  return (
    <span className="text-[26px] lg:text-[30px] font-bold leading-none tracking-tight tabular-nums">
      {prefix}
      <CountUp value={value} compact={compact} />
      {suffix}
    </span>
  );
}

/* large summary card */
function Kpi({
  label,
  value,
  hint,
  prefix = "₨ ",
  suffix = "",
  dark = false,
  money = true,
}: {
  label: string;
  value: number;
  hint?: string;
  prefix?: string;
  suffix?: string;
  dark?: boolean;
  money?: boolean;
}) {
  return (
    <Card dark={dark} className="p-5 h-full flex flex-col justify-between gap-5">
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
          dark ? "text-neutral-400" : "text-neutral-500"
        }`}
      >
        {label}
      </p>
      <div>
        <div className={dark ? "text-white" : "text-[#171717]"}>
          {money ? (
            <KpiNumber value={value} prefix={prefix} suffix={suffix} />
          ) : (
            <KpiNumber value={value} suffix={suffix} compact={false} />
          )}
        </div>
        {hint && (
          <p
            className={`mt-2.5 text-[11px] font-normal ${
              dark ? "text-neutral-500" : "text-neutral-400"
            }`}
          >
            {hint}
          </p>
        )}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const {
    stats, customers, customerBalance, suppliers, supplierBalance,
    sales, payments, expenses, byItem, purchases,
  } = useStore();
  const [period, setPeriod] = useState<Period>("monthly");

  /* period-scoped sales / payments / expenses */
  const pSales = useMemo(() => sales.filter((x) => inPeriod(x.date, period)), [sales, period]);
  const pPayments = useMemo(
    () => payments.filter((x) => inPeriod(x.date, period)),
    [payments, period]
  );
  const pExpenses = useMemo(
    () => expenses.filter((x) => inPeriod(x.date, period)),
    [expenses, period]
  );

  const moneyIn = pPayments
    .filter((p) => p.type === "customer")
    .reduce((a, p) => a + p.amount, 0);

  const salesTotal = useMemo(
    () => pSales.reduce((a, s) => a + saleTotal(s), 0),
    [pSales]
  );

  /* gross profit for the period + what was collected */
  const grossProfit = useMemo(() => {
    let gp = 0;
    for (const s of pSales)
      for (const l of s.lines) gp += l.qty * (l.rate - (byItem[l.item] ?? 0));
    return gp;
  }, [pSales, byItem]);

  /* net profit for the period after shop expenses */
  const netProfit = useMemo(() => {
    const totalExpenses = pExpenses.reduce((a, e) => a + e.amount, 0);
    return grossProfit - totalExpenses;
  }, [grossProfit, pExpenses]);

  /* outstanding money — what customers owe us + what we owe mills */
  const dues = useMemo(() => {
    let receivable = 0;
    for (const c of customers) receivable += Math.max(0, customerBalance(c.id));
    let payable = 0;
    for (const s of suppliers) payable += Math.max(0, supplierBalance(s.id));
    return { receivable, payable };
  }, [customers, suppliers, customerBalance, supplierBalance]);

  /* top five customers by what they owe us */
  const topCustomers = sortBy(customers, (c) => Math.max(0, customerBalance(c.id)))
    .slice(0, 5)
    .map((c) => ({ c, bal: Math.max(0, customerBalance(c.id)) }));

  /* top five mills we still owe */
  const topSuppliers = sortBy(suppliers, (s) => Math.max(0, supplierBalance(s.id)))
    .slice(0, 5)
    .map((s) => ({ s, bal: Math.max(0, supplierBalance(s.id)) }));

  /* latest five purchases with supplier name and payment status */
  const recentPurchases = [...purchases]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((p) => ({
      p,
      supplier: suppliers.find((s) => s.id === p.supplierId)?.name ?? "—",
      due: Math.max(0, steelAmount(p) - (p.paid ?? 0)),
    }));

  const day = useMemo(
    () =>
      new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    []
  );

  const quickActions: { label: string; href: string }[] = [
    { label: "Add Purchase", href: "/purchases" },
    { label: "Add Product", href: "/products" },
    { label: "Create Invoice", href: "/sales" },
    { label: "Add Customer", href: "/customers" },
    { label: "Record Payment", href: "/payments" },
    { label: "View Reports", href: "/reports" },
  ];

  return (
    <Page>
      {/* ===== Header ===== */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[22px] sm:text-2xl font-semibold tracking-tight">
            Good Morning, M. Kashif
          </h1>
          <p className="text-[13px] text-neutral-500 mt-1.5">{day}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* period switcher */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white border border-neutral-200">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  period === p.key
                    ? "bg-[#171717] text-white"
                    : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* notifications */}
    

          {/* profile */}
          <div className="flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-lg bg-white border border-neutral-200">
            <div className="w-7 h-7 rounded-full bg-[#171717] text-white flex items-center justify-center text-[10px] font-semibold tracking-wide">
              MK
            </div>
            <div className="leading-tight">
              <p className="text-[13px] font-semibold text-[#171717]">M. Kashif</p>
              <p className="text-[10px] text-neutral-500">Owner</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Row 1 — Key figures ===== */}
      <Stagger className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5 mb-6">
        <StaggerItem>
          <Kpi
            dark
            label="Total Stock"
            value={stats.stockQty}
            money={false}
            suffix=" t"
            hint={`Worth ${fmtCompact(stats.stockValue)}`}
          />
        </StaggerItem>
        <StaggerItem>
          <Kpi label="Stock Worth" value={stats.stockValue} hint="At average landed cost" />
        </StaggerItem>
        <StaggerItem>
          <Kpi label="Total Sales" value={salesTotal} hint={`${fmtCompact(moneyIn)} collected in period`} />
        </StaggerItem>
        <StaggerItem>
          <Kpi label="Profit" value={netProfit} hint={`Gross ${fmtCompact(grossProfit)}`} />
        </StaggerItem>
        <StaggerItem>
          <Card className="p-5 h-full flex flex-col justify-between gap-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              Payments Due
            </p>
            <div>
              <div className="text-[#171717]">
                <KpiNumber value={dues.receivable + dues.payable} />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                <span className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#b3261e]" />
                  Customers {fmtCompact(dues.receivable)}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#b3261e]" />
                  Mills {fmtCompact(dues.payable)}
                </span>
              </div>
            </div>
          </Card>
        </StaggerItem>
      </Stagger>

      {/* ===== Row 2 — Customer balances + Mill dues ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <SectionTitle action={<ViewAll href="/customers" />}>
            Top Customer Balances
          </SectionTitle>
          {topCustomers.length === 0 ? (
            <p className="text-sm text-neutral-400 py-8 text-center">
              No outstanding customer balances.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {topCustomers.map(({ c, bal }) => (
                <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#171717] truncate">{c.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{c.shop}</p>
                  </div>
                  <Badge tone="neg">{fmtMoney(bal)} due</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle action={<ViewAll href="/suppliers" />}>
            Outstanding to Mills
          </SectionTitle>
          {topSuppliers.length === 0 ? (
            <p className="text-sm text-neutral-400 py-8 text-center">
              Nothing owed to mills right now.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {topSuppliers.map(({ s, bal }) => (
                <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#171717] truncate">{s.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{s.mill}</p>
                  </div>
                  <Badge tone="neg">{fmtMoney(bal)} due</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ===== Row 3 — Recent Purchases + Quick Actions ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <SectionTitle action={<ViewAll href="/purchases" />}>Recent Purchases</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="!pl-5">Date</th>
                  <th>Supplier</th>
                  <th>Product</th>
                  <th className="num">Amount</th>
                  <th className="num !pr-5">Payment</th>
                </tr>
              </thead>
              <tbody>
                {recentPurchases.map(({ p, supplier, due }) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap text-xs text-neutral-500 !pl-5">
                      {fmtDate(p.date)}
                    </td>
                    <td className="font-medium">{supplier}</td>
                    <td className="text-neutral-600">{p.item}</td>
                    <td className="num">{fmtMoney(p.qty * p.rate + p.transport + p.otherCost)}</td>
                    <td className="num !pr-5">
                      {due > 0 ? (
                        <Badge tone="neg">Due {fmtMoney(due)}</Badge>
                      ) : (
                        <Badge tone="pos">Paid</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle>Quick Actions</SectionTitle>
          <div className="p-4 grid grid-cols-2 gap-2.5">
            {quickActions.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="group flex items-center justify-between gap-2 px-3.5 py-3 rounded-lg border border-neutral-200 text-sm font-medium text-[#171717] hover:bg-[#171717] hover:text-white hover:border-[#171717] transition-colors duration-150"
              >
                {a.label}
                <span className="text-neutral-400 group-hover:text-white transition-colors text-xs">
                  →
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  );
}
