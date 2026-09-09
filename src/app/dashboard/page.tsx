"use client";

import { useMemo, useState } from "react";
import { useStore, saleGrandTotal } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Page, Stagger, StaggerItem, CountUp } from "@/components/ui";
import { fmtCompact, fmtMoney, qtyUnitLabel } from "@/lib/format";

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
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    );
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
    <span className="text-[30px] sm:text-[36px] lg:text-[42px] font-bold leading-none tracking-tight tabular-nums">
      {prefix}
      <CountUp value={value} compact={compact} />
      {suffix}
    </span>
  );
}

/* sales + profit hero — one prominent card, profit leads */
function SalesProfitHero({
  salesTotal,
  profitValue,
  salesHint,
  profitHint,
}: {
  salesTotal: number;
  profitValue: number;
  salesHint: string;
  profitHint: string;
}) {
  return (
    <Card dark className="p-6 sm:p-8 h-full min-h-[220px] flex flex-col justify-between gap-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Net profit
        </p>
        <div className="mt-3 text-white">
          <span className="text-[38px] sm:text-[48px] lg:text-[56px] font-bold leading-none tracking-tight tabular-nums">
            ₨ <CountUp value={profitValue} compact />
          </span>
        </div>
        <p className="mt-3 text-[12px] text-neutral-500 leading-relaxed max-w-md">{profitHint}</p>
      </div>
      <div className="pt-5 border-t border-neutral-800">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
          Sales in period
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <span className="text-[26px] sm:text-[32px] font-bold text-white tabular-nums leading-none">
            ₨ <CountUp value={salesTotal} compact />
          </span>
          <p className="text-[11px] text-neutral-500 max-w-[200px] text-right leading-snug">{salesHint}</p>
        </div>
      </div>
    </Card>
  );
}

/* dues card — always visible */
function DueCard({
  label,
  value,
  count,
  names,
  emptyLabel,
  tone,
}: {
  label: string;
  value: number;
  count: number;
  names: { name: string; bal: number }[];
  emptyLabel: string;
  tone: "in" | "out";
}) {
  const accent = tone === "in" ? "text-[#2e6b2e]" : "text-[#a12b1f]";
  const hint =
    count > 0
      ? names.slice(0, 3).map((d) => `${d.name} ${fmtCompact(d.bal)}`).join(" · ")
      : emptyLabel;

  return (
    <Card className="p-5 h-full flex flex-col justify-between gap-4 min-h-[140px]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{label}</p>
      <div>
        <p className={`text-[28px] sm:text-[32px] font-bold tabular-nums leading-none ${value > 0 ? accent : "text-neutral-400"}`}>
          {value > 0 ? fmtMoney(value) : "—"}
        </p>
        <p className="mt-2.5 text-[11px] text-neutral-400 leading-relaxed line-clamp-2">{hint}</p>
      </div>
    </Card>
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
    <Card
      dark={dark}
      className="p-5 h-full flex flex-col justify-between gap-5"
    >
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
  const { user } = useAuth();
  const initials = (user?.name ?? "O")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
    [],
  );

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  /* item -> product category map (drives which sales belong to a product) */
  const productOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of inventory) if (r.product) m[r.item] = r.product;
    return m;
  }, [inventory]);

  /* scope inventory + sales down to the selected product */
  const invRows = useMemo(
    () =>
      isAll ? inventory : inventory.filter((r) => r.product === product!.name),
    [inventory, isAll, product],
  );
  const saleRows = useMemo(
    () =>
      isAll
        ? sales
        : sales.filter((s) =>
            s.lines.some((l) => productOf[l.item] === product!.name),
          ),
    [sales, isAll, product, productOf],
  );

  /* period-scoped sales / payments / expenses */
  const pSales = useMemo(
    () => saleRows.filter((x) => inPeriod(x.date, period)),
    [saleRows, period],
  );
  const pPayments = useMemo(
    () => payments.filter((x) => inPeriod(x.date, period)),
    [payments, period],
  );
  const pExpenses = useMemo(
    () => expenses.filter((x) => inPeriod(x.date, period)),
    [expenses, period],
  );

  const moneyIn = pPayments
    .filter((p) => p.type === "customer")
    .reduce((a, p) => a + p.amount, 0);

  const salesTotal = useMemo(
    () => pSales.reduce((a, s) => a + saleGrandTotal(s), 0),
    [pSales],
  );

  /* profit of each sale = its selling price minus the actual cost of the
     stock it consumed (same costing as Profit & Loss) */
  const profitBySale = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of sales)
      m[s.id] = s.lines.reduce(
        (a, l, i) => a + l.qty * (l.rate - (lineUnitCost(s.id, i) || byItem[l.item] || 0)),
        0
      );
    return m;
  }, [sales, lineUnitCost, byItem]);

  /* Realized (cash-basis) profit: profit is counted only from customer
     payments actually received in the period, matched to the invoice the
     money settled — so an invoice's profit appears when the dues are paid,
     not when the goods leave the shop. Whole depot = net of shop expenses. */
  const realized = useMemo(() => {
    let profit = 0;
    let received = 0;
    const productName = product?.name ?? "";
    const depotProfit = saleRows.reduce((a, s) => a + (profitBySale[s.id] ?? 0), 0);
    const depotGrand = saleRows.reduce((a, s) => a + saleGrandTotal(s), 0);
    const blendedMargin = depotGrand > 0 ? depotProfit / depotGrand : 0;

    for (const pmt of pPayments) {
      if (pmt.type !== "customer") continue;
      const s = pmt.saleId ? sales.find((x) => x.id === pmt.saleId) ?? null : null;
      const inScope = isAll
        ? true
        : !!s && s.lines.some((l) => productOf[l.item] === productName);
      if (!inScope) continue;

      if (!s) {
        // unallocated payment — settled FIFO later; use the blended margin
        profit += pmt.amount * blendedMargin;
        received += pmt.amount;
        continue;
      }
      const grand = saleGrandTotal(s);
      if (grand <= 0) continue;

      if (isAll) {
        const margin = (profitBySale[s.id] ?? 0) / grand;
        profit += pmt.amount * margin;
        received += pmt.amount;
      } else {
        // attribute the payment to the chosen product's share of the invoice
        let prodProfit = 0;
        let prodRev = 0;
        s.lines.forEach((l, i) => {
          if (productOf[l.item] === productName) {
            const cost = lineUnitCost(s.id, i) || byItem[l.item] || 0;
            prodProfit += l.qty * (l.rate - cost);
            prodRev += l.qty * l.rate;
          }
        });
        profit += (pmt.amount * prodProfit) / grand;
        received += (pmt.amount * prodRev) / grand;
      }
    }
    return { profit, received };
  }, [pPayments, sales, saleRows, isAll, product, productOf, lineUnitCost, byItem, profitBySale]);

  /* shop expenses for the period (whole depot only) */
  const expensesPeriod = useMemo(
    () => pExpenses.reduce((a, e) => a + e.amount, 0),
    [pExpenses]
  );

  /* net profit shown on the card: realized − shop expenses (whole depot),
     or realized profit of the chosen product */
  const profitValue = useMemo(
    () => (isAll ? realized.profit - expensesPeriod : realized.profit),
    [isAll, realized.profit, expensesPeriod]
  );

  const stockQty = invRows.reduce((a, r) => a + r.stockQty, 0);
  const stockValue = invRows.reduce((a, r) => a + r.stockValue, 0);
  const itemCount = invRows.length;
  const inStockItems = invRows.filter((r) => r.stockQty > 0).length;
  /* all products can have different units (kg vs bag) — only a single product has a meaningful qty sum */
  const unitSuffix = isAll ? "" : qtyUnitLabel(product?.unit);
  const stockCard = isAll
    ? {
        value: inStockItems,
        suffix: "",
        hint: `${itemCount} tracked item${itemCount === 1 ? "" : "s"} in the depot`,
      }
    : {
        value: stockQty,
        suffix: unitSuffix ? ` ${unitSuffix}` : "",
        hint: `Worth ${fmtCompact(stockValue)}`,
      };

  /* dues are whole-depot figures — who owes us, and which mills we owe */
  const dues = useMemo(() => {
    const custDues = customers
      .map((c) => ({ name: c.name, bal: customerBalance(c.id) }))
      .filter((d) => d.bal > 0)
      .sort((a, b) => b.bal - a.bal);
    const millDues = suppliers
      .map((s) => ({ name: s.name, bal: supplierBalance(s.id) }))
      .filter((d) => d.bal > 0)
      .sort((a, b) => b.bal - a.bal);
    return {
      receivable: custDues.reduce((a, d) => a + d.bal, 0),
      payable: millDues.reduce((a, d) => a + d.bal, 0),
      owingCustomers: custDues.length,
      owingMills: millDues.length,
      custDues,
      millDues,
    };
  }, [customers, suppliers, customerBalance, supplierBalance]);

  return (
    <Page>
      {/* ===== Header ===== */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] sm:text-2xl font-semibold tracking-tight">
            {greeting}
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
              {initials}
            </div>
            <div className="leading-tight">
              <p className="text-[13px] font-semibold text-[#171717]">
                {user?.name}
              </p>
              <p className="text-[10px] text-neutral-500">
                {user?.businessName || "Owner"}
              </p>
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

      {/* ===== Stats — profit & sales first, dues always visible ===== */}
      <Stagger className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        <StaggerItem className="lg:col-span-12 xl:col-span-6">
          <SalesProfitHero
            salesTotal={salesTotal}
            profitValue={profitValue}
            salesHint={
              isAll
                ? `${fmtCompact(moneyIn)} collected · ${pSales.length} invoice${pSales.length === 1 ? "" : "s"}`
                : `${pSales.length} invoice${pSales.length === 1 ? "" : "s"} in period`
            }
            profitHint={
              realized.received > 0
                ? isAll
                  ? `Collected ${fmtCompact(realized.received)} · net after shop expenses`
                  : `${Math.round((realized.profit / realized.received) * 100)}% margin on ${fmtCompact(realized.received)} collected`
                : "Profit counts when customer payments are received"
            }
          />
        </StaggerItem>
        <StaggerItem className="lg:col-span-6 xl:col-span-3">
          <DueCard
            label="Customer dues"
            value={dues.receivable}
            count={dues.owingCustomers}
            names={dues.custDues}
            emptyLabel="No outstanding customer balances"
            tone="in"
          />
        </StaggerItem>
        <StaggerItem className="lg:col-span-6 xl:col-span-3">
          <DueCard
            label="Mill dues"
            value={dues.payable}
            count={dues.owingMills}
            names={dues.millDues}
            emptyLabel="Nothing owed to mills"
            tone="out"
          />
        </StaggerItem>
        <StaggerItem className="lg:col-span-6 xl:col-span-3">
          <Kpi
            dark
            label={isAll ? "Items in Stock" : "Stock in Hand"}
            value={stockCard.value}
            money={false}
            suffix={stockCard.suffix}
            hint={stockCard.hint}
          />
        </StaggerItem>
        <StaggerItem className="lg:col-span-6 xl:col-span-3">
          <Kpi
            label="Stock Worth"
            value={stockValue}
            hint="At average landed cost"
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
