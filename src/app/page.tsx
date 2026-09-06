"use client";

import { useMemo, useState } from "react";
import { useStore, saleGrandTotal } from "@/lib/store";
import { Page, Stagger, StaggerItem, CountUp } from "@/components/ui";
import { fmtCompact, qtyUnitLabel } from "@/lib/format";

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
    customers,
    suppliers,
    sales,
    payments,
    expenses,
    inventory,
    byItem,
    lineUnitCost,
    products,
    customerBalance,
    supplierBalance,
  } = useStore();

  const [period, setPeriod] = useState<Period>("monthly");
  const [productId, setProductId] = useState<string>("all");
  const product = products.find((p) => p.id === productId) ?? null;
  const isAll = !product;

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

  /* item -> product category map (drives which sales belong to a product) */
  const productOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of inventory) if (r.product) m[r.item] = r.product;
    return m;
  }, [inventory]);

  /* scope inventory + sales down to the selected product */
  const invRows = useMemo(
    () => (isAll ? inventory : inventory.filter((r) => r.product === product!.name)),
    [inventory, isAll, product]
  );
  const saleRows = useMemo(
    () =>
      isAll
        ? sales
        : sales.filter((s) => s.lines.some((l) => productOf[l.item] === product!.name)),
    [sales, isAll, product, productOf]
  );

  /* period-scoped sales / payments / expenses */
  const pSales = useMemo(
    () => saleRows.filter((x) => inPeriod(x.date, period)),
    [saleRows, period]
  );
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
    () => pSales.reduce((a, s) => a + saleGrandTotal(s), 0),
    [pSales]
  );

  /* gross profit for the period */
  const grossProfit = useMemo(() => {
    let gp = 0;
    for (const s of pSales) {
      for (const [i, l] of s.lines.entries())
        gp += l.qty * (l.rate - (lineUnitCost(s.id, i) || byItem[l.item] || 0));
    }
    return gp;
  }, [pSales, lineUnitCost, byItem]);

  /* net profit for the period after shop expenses — whole-depot only,
     since expenses can't be attributed to a single product */
  const profitValue = useMemo(() => {
    if (!isAll) return grossProfit;
    const totalExpenses = pExpenses.reduce((a, e) => a + e.amount, 0);
    return grossProfit - totalExpenses;
  }, [isAll, grossProfit, pExpenses]);

  const stockQty = invRows.reduce((a, r) => a + r.stockQty, 0);
  const stockValue = invRows.reduce((a, r) => a + r.stockValue, 0);
  const itemCount = invRows.length;
  const inStockItems = invRows.filter((r) => r.stockQty > 0).length;
  /* all products can have different units (kg vs bag) — only a single product has a meaningful qty sum */
  const unitSuffix = isAll ? "" : qtyUnitLabel(product?.unit);
  const stockCard = isAll
    ? { value: inStockItems, suffix: "", hint: `${itemCount} tracked item${itemCount === 1 ? "" : "s"} in the depot` }
    : { value: stockQty, suffix: unitSuffix ? ` ${unitSuffix}` : "", hint: `Worth ${fmtCompact(stockValue)}` };

  /* dues are whole-depot figures — what customers owe us + what we owe mills */
  const dues = useMemo(() => {
    let receivable = 0;
    let owingCustomers = 0;
    for (const c of customers) {
      const bal = customerBalance(c.id);
      if (bal > 0) {
        receivable += bal;
        owingCustomers += 1;
      }
    }
    let payable = 0;
    let owingMills = 0;
    for (const s of suppliers) {
      const bal = supplierBalance(s.id);
      if (bal > 0) {
        payable += bal;
        owingMills += 1;
      }
    }
    return { receivable, payable, owingCustomers, owingMills };
  }, [customers, suppliers, customerBalance, supplierBalance]);

  return (
    <Page>
      {/* ===== Header ===== */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
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

      {/* ===== Product picker ===== */}
      <div className="mb-8 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="w-full sm:w-80">
          <label htmlFor="product-filter">Data for</label>
          <select
            id="product-filter"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full bg-white !py-2.5"
          >
            <option value="all">All Products — entire depot</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500 pb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-black" />
          {isAll
            ? products.length === 0
              ? "No products yet — add them under Products"
              : `${products.length} product${products.length === 1 ? "" : "s"} · ${itemCount} tracked item${itemCount === 1 ? "" : "s"}`
            : `${product!.name} · ${qtyUnitLabel(product?.unit) || "unit"} · ${itemCount} item${itemCount === 1 ? "" : "s"} under it`}
        </div>
      </div>

      {/* ===== Stats — the dashboard is stats only ===== */}
      <Stagger className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <StaggerItem>
          <Kpi
            dark
            label={isAll ? "Items in Stock" : "Stock in Hand"}
            value={stockCard.value}
            money={false}
            suffix={stockCard.suffix}
            hint={stockCard.hint}
          />
        </StaggerItem>
        <StaggerItem>
          <Kpi label="Stock Worth" value={stockValue} hint="At average landed cost" />
        </StaggerItem>
        <StaggerItem>
          <Kpi
            label="Sales"
            value={salesTotal}
            hint={
              isAll
                ? `${fmtCompact(moneyIn)} collected in period`
                : `${pSales.length} invoice${pSales.length === 1 ? "" : "s"} in period`
            }
          />
        </StaggerItem>
        <StaggerItem>
          <Kpi
            label="Profit"
            value={profitValue}
            hint={
              isAll
                ? `Gross ${fmtCompact(grossProfit)}`
                : salesTotal > 0
                  ? `${Math.round((grossProfit / salesTotal) * 100)}% gross margin`
                  : "No sales in period yet"
            }
          />
        </StaggerItem>
        <StaggerItem>
          <Kpi
            label="Payment Dues"
            value={dues.receivable + dues.payable}
            hint="Customers + mills combined"
          />
        </StaggerItem>
        <StaggerItem>
          <Kpi
            label="Customer Payment Dues"
            value={dues.receivable}
            hint={
              dues.owingCustomers === 0
                ? "No one owes you right now"
                : `${dues.owingCustomers} customer${dues.owingCustomers === 1 ? "" : "s"} owe you`
            }
          />
        </StaggerItem>
        <StaggerItem>
          <Kpi
            label="Mills Payment Dues"
            value={dues.payable}
            hint={
              dues.owingMills === 0
                ? "All mills paid up"
                : `${dues.owingMills} mill${dues.owingMills === 1 ? "" : "s"} to pay`
            }
          />
        </StaggerItem>
      </Stagger>

      <p className="text-xs text-neutral-500 mt-6">
        {isAll
          ? "Showing the whole depot — pick a product above to zoom its stock, sales and profit."
          : `Stock, sales and profit are for ${product!.name}. Payment dues always cover the whole depot.`}
      </p>
    </Page>
  );
}
