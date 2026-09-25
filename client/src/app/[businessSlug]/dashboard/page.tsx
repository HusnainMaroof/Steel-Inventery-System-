"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Page, Stagger, StaggerItem } from "@/components/ui";
import { Skeleton } from "@/components/skeletons";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  dashboardReportCacheKey,
  dashboardReportParams,
} from "@/lib/dashboard-report";
import { readCache, writeCache } from "@/lib/query-cache";
import { fetchServerProfitReport, type ApiProfitReport } from "@/lib/server-report";
import { userFacingError } from "@/lib/user-error";
import { fmtCompact, fmtMoney, qtyUnitLabel } from "@/lib/format";

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
}: {
  value: number;
  loading: boolean;
  large?: boolean;
}) {
  if (loading) {
    return (
      <Skeleton
        className={`${large ? "h-12 sm:h-14 w-36" : "h-8 w-28"} rounded-md !bg-white/20`}
      />
    );
  }
  const cls = large
    ? "text-[38px] sm:text-[48px] lg:text-[56px] font-bold leading-none tracking-tight tabular-nums"
    : "text-[26px] sm:text-[32px] font-bold tabular-nums leading-none";
  return <span className={cls}>{fmtCompact(value)}</span>;
}

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

function Kpi({
  label,
  value,
  hint,
  prefix = "",
  suffix = "",
  dark = false,
  money = true,
  loading = false,
}: {
  label: string;
  value: number;
  hint?: string;
  prefix?: string;
  suffix?: string;
  dark?: boolean;
  money?: boolean;
  loading?: boolean;
}) {
  return (
    <Card
      dark={dark}
      className="p-5 h-full flex flex-col justify-between gap-5"
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
          dark ? "text-white" : "text-[#171717]"
        }`}
      >
        {label}
      </p>
      <div>
        <div className={dark ? "text-white" : "text-[#171717]"}>
          {loading ? (
            <Skeleton className={`h-9 w-24 rounded-md ${dark ? "!bg-white/20" : ""}`} />
          ) : money ? (
            <span className="text-[30px] sm:text-[36px] lg:text-[42px] font-bold leading-none tracking-tight tabular-nums">
              {prefix}
              {fmtCompact(value)}
              {suffix}
            </span>
          ) : (
            <span className="text-[30px] sm:text-[36px] lg:text-[42px] font-bold leading-none tracking-tight tabular-nums">
              {Math.round(value).toLocaleString()}
              {suffix}
            </span>
          )}
        </div>
        {hint && (
          <p
            className={`mt-2.5 text-[11px] font-normal ${
              dark ? "text-white" : "text-[#171717]"
            }`}
          >
            {hint}
          </p>
        )}
      </div>
    </Card>
  );
}
function SalesProfitHero({
  salesTotal,
  profitValue,
  loading,
}: {
  salesTotal: number;
  profitValue: number;
  loading: boolean;
}) {
  return (
    <Card dark className="p-6 sm:p-8 h-full min-h-[220px] flex flex-col justify-between gap-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
          Net profit
        </p>
        <div className="mt-3 text-white">
          <MoneyFigure value={profitValue} loading={loading} large />
        </div>
      </div>
      <div className="pt-5 border-t border-neutral-800">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
          Sales made
        </p>
        <div className="mt-2 text-white">
          <MoneyFigure value={salesTotal} loading={loading} />
        </div>
      </div>
    </Card>
  );
}

/* dues card — numbers only, no party names */
function DueCard({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: number;
  tone: "in" | "out";
  loading: boolean;
}) {
  const accent = tone === "in" ? "text-[#2e6b2e]" : "text-[#a12b1f]";

  return (
    <Card className="p-5 h-full flex flex-col justify-between gap-4 min-h-[140px]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#171717]">{label}</p>
      <div>
        {loading ? (
          <Skeleton className="h-8 w-32 rounded-md" />
        ) : (
          <p className={`text-[28px] sm:text-[32px] font-bold tabular-nums leading-none ${value > 0 ? accent : "text-[#171717]"}`}>
            {value > 0 ? fmtMoney(value) : "—"}
          </p>
        )}
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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] sm:text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-[#171717] mt-1.5">{day}</p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full sm:w-auto min-w-0">
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
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white border border-neutral-200 w-full sm:w-auto overflow-x-auto">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setPeriod(p.key);
                  setDateRange({ from: null, to: null });
                }}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  !rangeActive && period === p.key
                    ? "bg-[#171717] text-white"
                    : "text-[#171717] hover:text-black"
                }`}
              >
                {p.label}
              </button>
            ))}
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
            className="w-full min-w-0 bg-white !py-2.5"
          >
            <option value="all">All Products — entire depot</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ===== Stats — loaded from database for the selected dates ===== */}
      {summaryError && (
        <p className="text-sm text-[#a12b1f] mb-4" role="alert">
          {summaryError}
        </p>
      )}
      <Stagger
        className={`grid grid-cols-1 lg:grid-cols-12 gap-3.5 ${summaryLoading && summary ? "opacity-70" : ""}`}
      >
        <StaggerItem className="lg:col-span-12 xl:col-span-6">
          <SalesProfitHero
            salesTotal={salesTotal}
            profitValue={profitValue}
            loading={statsLoading}
          />
        </StaggerItem>
        <StaggerItem className="lg:col-span-6 xl:col-span-3">
          <DueCard
            label="Customer dues"
            value={customerDue}
            tone="in"
            loading={statsLoading}
          />
        </StaggerItem>
        <StaggerItem className="lg:col-span-6 xl:col-span-3">
          <DueCard
            label="Mill dues"
            value={supplierDue}
            tone="out"
            loading={statsLoading}
          />
        </StaggerItem>
        <StaggerItem className="lg:col-span-6 xl:col-span-3">
          <Kpi
            dark
            label={isAll ? "Products in Stock" : "Stock in Hand"}
            value={stockCount}
            money={false}
            suffix={stockSuffix}
            loading={statsLoading}
          />
        </StaggerItem>
        <StaggerItem className="lg:col-span-6 xl:col-span-3">
          <Kpi
            label="Stock Worth"
            value={stockValue}
            loading={statsLoading}
          />
        </StaggerItem>
      </Stagger>
    </Page>
  );
}
