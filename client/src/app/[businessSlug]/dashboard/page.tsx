"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  Factory,
  HandCoins,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useBusinessHref, useCanOpenPage } from "@/components/BusinessLink";
import { CustomSelect, Page, Stagger, StaggerItem } from "@/components/ui";
import { Skeleton } from "@/components/skeletons";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  dashboardReportCacheKey,
  dashboardReportParams,
} from "@/lib/dashboard-report";
import { readCache, writeCache } from "@/lib/query-cache";
import { fetchServerProfitReport, type ApiProfitReport } from "@/lib/server-report";
import { userFacingError } from "@/lib/user-error";
import { fmtMoney as fmtMoneyRaw, fmtQtyNumber, qtyUnitLabel } from "@/lib/format";

/** Keeps the currency sign on the same line as its number when a long value wraps. */
const fmtMoney = (n: number) => fmtMoneyRaw(n).replace(" ", "\u00a0");

type Period = "today" | "monthly" | "yearly";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "monthly", label: "This Month" },
  { key: "yearly", label: "This Year" },
];

function MoneyFigure({
  value,
  loading,
  large = false,
  valueClassName = "text-white",
}: {
  value: number;
  loading: boolean;
  large?: boolean;
  valueClassName?: string;
}) {
  if (loading) {
    return (
      <Skeleton
        className={`${large ? "h-12 sm:h-14 w-36" : "h-8 w-28"} rounded-md !bg-white/20`}
      />
    );
  }
  const cls = large
    ? "text-[clamp(2rem,11cqi,3.5rem)] font-bold leading-[1.05] tracking-tight tabular-nums"
    : "text-[26px] sm:text-[32px] font-bold tabular-nums leading-[1.05]";
  return (
    <span className={`${cls} ${valueClassName} block [overflow-wrap:anywhere]`}>
      {fmtMoney(value)}
    </span>
  );
}

/* ---------- shared dashboard cards ---------- */

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
      className={`@container h-full overflow-hidden rounded-2xl border ${
        dark ? "border-ink bg-ink text-white" : "border-[#E5E5E5] bg-white"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  href,
  icon: Icon,
  suffix = "",
  money = true,
  loading = false,
  tone,
  zeroAsDash = false,
}: {
  label: string;
  value: number;
  hint: string;
  href: string;
  icon: LucideIcon;
  suffix?: string;
  money?: boolean;
  loading?: boolean;
  tone?: "in" | "out";
  zeroAsDash?: boolean;
}) {
  const businessHref = useBusinessHref();
  const canOpen = useCanOpenPage();
  const valueClass =
    value > 0 && tone === "in"
      ? "text-success"
      : value > 0 && tone === "out"
        ? "text-destructive"
        : "text-[#171717]";

  return (
    <Card className="flex flex-col justify-between gap-5 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#F4F4F3] text-[#171717]/70">
            <Icon aria-hidden="true" className="size-[18px]" />
          </span>
          <p className="min-w-0 text-[13px] font-medium leading-snug text-[#171717]/70">
            {label}
          </p>
        </div>
        {canOpen(href) && (
          <Link
            href={businessHref(href)}
            aria-label={`Open ${label}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-[#171717]/70 transition-colors hover:text-[#171717] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <span className="flex size-9 items-center justify-center rounded-full border border-[#E5E5E5] hover:bg-[#F8F8F7]">
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </span>
          </Link>
        )}
      </div>
      <div>
        {loading ? (
          <Skeleton className="h-8 w-32 rounded-md" />
        ) : (
          <p
            className={`text-[clamp(1.25rem,10cqi,2rem)] font-bold leading-[1.05] tracking-tight tabular-nums [overflow-wrap:anywhere] ${valueClass}`}
          >
            {zeroAsDash && value <= 0
              ? "—"
              : money
                ? fmtMoney(value)
                : `${fmtQtyNumber(value)}${suffix}`}
          </p>
        )}
        <p className="mt-2 whitespace-nowrap text-xs leading-4 text-[#171717]/70">{hint}</p>
      </div>
    </Card>
  );
}

function SalesProfitHero({
  salesTotal,
  profitValue,
  loading,
  activePeriod,
  sharedExpenses = 0,
}: {
  salesTotal: number;
  profitValue: number;
  loading: boolean;
  activePeriod: string;
  /** product view: shop expenses shared to this product by its sales */
  sharedExpenses?: number;
}) {
  return (
    <Card dark className="flex min-h-[240px] flex-col justify-between gap-6 p-6 sm:p-8">
      <div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-[13px] font-medium text-white/80">Net profit</p>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
            {activePeriod}
          </span>
        </div>
        <div className="mt-3">
          <MoneyFigure
            value={profitValue}
            loading={loading}
            large
            valueClassName={profitValue < 0 ? "text-[#ff8a7a]" : "text-white"}
          />
        </div>
        {!loading && sharedExpenses > 0 && (
          <p className="mt-2 text-xs text-white/70">
            After {fmtMoney(sharedExpenses)} share of shop expenses
          </p>
        )}
      </div>
      <div className="border-t border-white/10 pt-5">
        <p className="text-xs font-medium text-white/70">Sales made</p>
        <div className="mt-2 text-white">
          <MoneyFigure value={salesTotal} loading={loading} />
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const {
    products,
    ready,
    dataVersion,
  } = useStore();

  const [period, setPeriod] = useState<Period>("monthly");
  const [dateRange, setDateRange] = useState<{ from: string | null; to: string | null }>({
    from: null,
    to: null,
  });
  const [productId, setProductId] = useState<string>("all");
  const product = products.find((p) => p.id === productId) ?? null;
  const isAll = !product;
  const rangeActive = !!(dateRange.from || dateRange.to);

  const reportParams = useMemo(
    () => dashboardReportParams(period, rangeActive, dateRange, productId),
    [period, rangeActive, dateRange, productId],
  );

  const [summary, setSummary] = useState<ApiProfitReport | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const cacheKey = dashboardReportCacheKey(reportParams, dataVersion);
    const cached = readCache<ApiProfitReport>(cacheKey, dataVersion);
    if (cached) {
      setSummary(cached);
      setSummaryLoading(false);
      setSummaryError(null);
      return;
    }

    let cancelled = false;
    setSummary(null);
    setSummaryLoading(true);
    setSummaryError(null);
    void fetchServerProfitReport(reportParams)
      .then((data) => {
        if (!cancelled) {
          writeCache(cacheKey, dataVersion, data);
          setSummary(data);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setSummary(null);
          setSummaryError(
            userFacingError(reason, "Could not load dashboard figures"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, dataVersion, reportParams]);

  const salesTotal = summary?.profit.salesRevenue ?? 0;
  const profitValue = summary?.profit.netProfit ?? 0;
  const customerDue = summary?.dues.customerDue ?? 0;
  const supplierDue = summary?.dues.supplierDue ?? 0;
  const stockValue = summary?.remainingValuation ?? 0;

  const stockRows = summary?.stock ?? [];
  const inStockProducts = stockRows.filter((r) => r.remainingQty > 0.000001).length;
  const productStock = product ? stockRows.find((r) => r.productId === product.id) : null;
  const stockQty = productStock?.remainingQty ?? 0;

  const unitSuffix = isAll ? "" : qtyUnitLabel(product?.unit);
  const stockCount = isAll ? inStockProducts : stockQty;
  const stockSuffix = isAll ? "" : unitSuffix ? ` ${unitSuffix}` : "";

  const statsLoading = summaryLoading || !summary;

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

  return (
    <Page>
      <div className="mb-5">
        <h1 className="text-[26px] sm:text-[30px] font-bold leading-tight tracking-tight text-[#111]">Dashboard</h1>
        <p className="mt-1 text-[13px] text-[#171717]/70">{day}</p>
      </div>

      {/* ===== Toolbar: what the numbers are for, and for which dates ===== */}
      <div className="mb-7 flex flex-col gap-2.5 rounded-2xl border border-[#E5E5E5] bg-white p-2 sm:flex-row sm:flex-wrap sm:items-center">
        <CustomSelect
          value={productId}
          onChange={setProductId}
          ariaLabel="Data for"
          className="w-full sm:w-72"
          options={[
            { value: "all", label: "All products" },
            ...products.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <div className="hidden h-6 w-px bg-[#E5E5E5] sm:block" aria-hidden="true" />
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={setDateRange}
          onClear={() => setDateRange({ from: null, to: null })}
          placeholder="Pick dates"
          ariaLabel="Filter dashboard by date range"
          className="w-full sm:w-auto"
          disableFuture
        />
        {/* period switcher — uses preset when no custom range is active */}
        <div className="flex w-full items-center gap-1 overflow-x-auto rounded-xl bg-[#F4F4F2] p-1 sm:ml-auto sm:w-auto">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={!rangeActive && period === p.key}
              onClick={() => {
                setPeriod(p.key);
                setDateRange({ from: null, to: null });
              }}
              className={`min-h-9 flex-1 whitespace-nowrap rounded-lg px-3.5 text-[13px] font-medium transition-[background-color,color,box-shadow] sm:flex-none ${
                !rangeActive && period === p.key
                  ? "bg-white text-[#171717] shadow-[0_1px_2px_rgba(17,17,17,0.08),0_4px_10px_-6px_rgba(17,17,17,0.25)]"
                  : "text-[#171717]/70 hover:text-[#171717]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Stats — loaded from database for the selected dates ===== */}
      {summaryError && (
        <p className="text-sm text-destructive mb-4" role="alert">
          {summaryError}
        </p>
      )}
      <Stagger
        className={`grid grid-cols-1 gap-3.5 lg:grid-cols-12 ${summaryLoading && summary ? "opacity-70" : ""}`}
      >
        <StaggerItem className="lg:col-span-12 xl:col-span-6">
          <SalesProfitHero
            salesTotal={salesTotal}
            profitValue={profitValue}
            sharedExpenses={summary?.profit.sharedExpenses ?? 0}
            loading={statsLoading}
            activePeriod={
              rangeActive
                ? "Selected dates"
                : period === "today"
                  ? "Today"
                  : period === "monthly"
                    ? "This month"
                    : "This year"
            }
          />
        </StaggerItem>
        <StaggerItem className="lg:col-span-6 xl:col-span-3">
          <Kpi
            label="Customer dues"
            value={customerDue}
            hint="To collect from customers"
            href="/customers"
            icon={HandCoins}
            tone="in"
            zeroAsDash
            loading={statsLoading}
          />
        </StaggerItem>
        <StaggerItem className="lg:col-span-6 xl:col-span-3">
          <Kpi
            label="Mill dues"
            value={supplierDue}
            hint="To pay to mills"
            href="/suppliers"
            icon={Factory}
            tone="out"
            zeroAsDash
            loading={statsLoading}
          />
        </StaggerItem>
        <StaggerItem className="lg:col-span-6 xl:col-span-6">
          <Kpi
            label={isAll ? "Products in stock" : "Stock in hand"}
            value={stockCount}
            hint={isAll ? "Products with stock left" : "In hand"}
            href="/inventory"
            icon={Boxes}
            money={false}
            suffix={stockSuffix}
            loading={statsLoading}
          />
        </StaggerItem>
        <StaggerItem className="lg:col-span-6 xl:col-span-6">
          <Kpi
            label="Stock worth"
            value={stockValue}
            hint="Value of stock still in hand"
            href="/inventory"
            icon={Warehouse}
            loading={statsLoading}
          />
        </StaggerItem>
      </Stagger>
    </Page>
  );
}
