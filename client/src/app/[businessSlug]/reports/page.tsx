"use client";

import { useEffect, useMemo, useState } from "react";
import { BusinessLink } from "@/components/BusinessLink";
import { useStore } from "@/lib/store";
import { BusyButton, CustomSelect, EmptyState, ErrorState, Modal, Page } from "@/components/ui";
import { DateRangePicker, formatRangeLabel } from "@/components/ui/date-range-picker";
import { ReportsSkeleton } from "@/components/skeletons";
import { fmtDate, qtyUnitLabel } from "@/lib/format";
import { userFacingError } from "@/lib/user-error";
import {
  StockSummary,
  ProfitLoss,
  CashPosition,
  BusinessValue,
  MoneySides,
  Expenses,
  StockCheckPanel,
} from "@/components/reports/ReportSections";
import { ExportMenu } from "@/components/reports/shared";
import { downloadReportCsv, printReportPdf } from "@/lib/reports";
import {
  buildProfitReport,
  type ReportMode,
} from "@/lib/profitReport";
import { readCache, writeCache } from "@/lib/query-cache";
import { fetchServerProfitReport, mergeServerReport } from "@/lib/server-report";

type ReportTab = "profit" | "stock" | "cash" | "dues";

const REPORT_TABS: { id: ReportTab; label: string; meaning: string }[] = [
  { id: "profit", label: "Profit", meaning: "Did this period make money?" },
  { id: "stock", label: "Stock", meaning: "What came in and what is left in the yard?" },
  { id: "cash", label: "Cash", meaning: "How much money is in hand?" },
  { id: "dues", label: "Dues", meaning: "Who owes who, and for how long?" },
];

export default function ReportsPage() {
  const store = useStore();
  const {
    purchases,
    sales,
    products,
    categories,
    variants,
    productItems,
    payments,
    expenses,
    customers,
    suppliers,
    byItem,
    lineUnitCost,
    salePaid,
    stockChecks,
    recordStockCheck,
    isPending,
  } = store;

  const now = useMemo(() => new Date(), []);
  const [tab, setTab] = useState<ReportTab>("profit");
  /* default scope: the current month */
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
    ).padStart(2, "0")}`;
  });
  const [productId, setProductId] = useState("");
  const [checkProductId, setCheckProductId] = useState("");
  const [checkQty, setCheckQty] = useState("");
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [serverReport, setServerReport] = useState<Awaited<
    ReturnType<typeof fetchServerProfitReport>
  > | null>(null);

  const mode: ReportMode = fromDate || toDate ? "range" : "all";
  const yearNum = now.getFullYear();

  const productOptions = useMemo(
    () => [
      { value: "", label: "All Products" },
      ...products
        .filter((p) => p.active !== false)
        .map((p) => ({ value: p.id, label: p.name })),
    ],
    [products]
  );

  const reportInput = useMemo(
    () => ({
      mode,
      year: yearNum,
      rangeFrom: fromDate || undefined,
      rangeTo: toDate || undefined,
      productId,
      now,
      products,
      categories,
      variants,
      productItems,
      purchases,
      sales,
      payments,
      expenses,
      customers,
      suppliers,
      lineUnitCost,
      byItem,
      salePaid,
      stockChecks,
    }),
    [
      mode,
      yearNum,
      fromDate,
      toDate,
      productId,
      now,
      products,
      categories,
      variants,
      productItems,
      purchases,
      sales,
      payments,
      expenses,
      customers,
      suppliers,
      lineUnitCost,
      byItem,
      salePaid,
      stockChecks,
    ],
  );

  useEffect(() => {
    if (!store.ready) return;
    const cacheKey = `report:${mode}:${yearNum}:${fromDate}:${toDate}:${productId}`;
    const cached = readCache<Awaited<ReturnType<typeof fetchServerProfitReport>>>(
      cacheKey,
      store.dataVersion,
    );
    if (cached) {
      setServerReport(cached);
      setReportLoading(false);
      setReportError(null);
      return;
    }

    let cancelled = false;
    setReportLoading(true);
    setReportError(null);
    void fetchServerProfitReport({
      mode,
      year: yearNum,
      from: fromDate || undefined,
      to: toDate || undefined,
      productId: productId || undefined,
    })
      .then((data) => {
        if (!cancelled) {
          writeCache(cacheKey, store.dataVersion, data);
          setServerReport(data);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setServerReport(null);
          setReportError(
            userFacingError(reason, "Could not load report from server"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setReportLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [store.ready, store.dataVersion, mode, yearNum, fromDate, toDate, productId]);

  const report = useMemo(() => {
    const local = buildProfitReport(reportInput);
    if (!serverReport) return local;
    return mergeServerReport(serverReport, reportInput);
  }, [reportInput, serverReport]);

  const checkProduct =
    products.find((p) => p.id === checkProductId) ??
    products.find((p) => p.id === productId) ??
    products[0];

  const openCheck = (id: string) => {
    setCheckProductId(id || productId || products[0]?.id || "");
    setCheckQty("");
    setCheckError("");
    setCheckOpen(true);
  };

  const saveCheck = async () => {
    if (isPending("stock-check:create")) return;
    const qty = Number(checkQty);
    if (!checkProduct) {
      setCheckError("Pick a product first.");
      return;
    }
    if (!Number.isFinite(qty) || qty < 0) {
      setCheckError("Enter the counted quantity.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const date = today < report.from ? report.from : today > report.to ? report.to : today;
    await recordStockCheck({
      date,
      productId: checkProduct.id,
      physicalQty: qty,
    });
    setCheckOpen(false);
  };

  const hasAny = purchases.length > 0 || sales.length > 0;
  const headerLabel =
    mode === "range"
      ? formatRangeLabel(fromDate || null, toDate || null, "All time")
      : "All time";

  return (
    <Page>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">
        {headerLabel}
        {productId ? (
          <span className="font-medium text-base sm:text-lg text-[#171717]/70">
            {" "}· {report.productLabel}
          </span>
        ) : null}
      </h1>

      <div className="flex flex-wrap items-center gap-2 mb-8">
        <CustomSelect
          compact
          className="min-w-[12rem] [&_button]:min-h-[44px]"
          ariaLabel="Product"
          value={productId}
          onChange={setProductId}
          options={productOptions}
        />
        <DateRangePicker
          from={fromDate}
          to={toDate}
          onChange={(r) => {
            setFromDate(r.from ?? "");
            setToDate(r.to ?? "");
          }}
          placeholder="All dates"
          ariaLabel="Filter report by date range"
        />
        <div className="ml-auto shrink-0">
        <ExportMenu
          onExcel={() => downloadReportCsv(report)}
          onPdf={() => printReportPdf(report)}
        />
        </div>
      </div>

      {reportLoading && !hasAny ? <ReportsSkeleton /> : null}

      {reportError && !reportLoading && !hasAny ? (
        <ErrorState
          title="Could not load report"
          message={reportError}
          onRetry={() => {
            setReportLoading(true);
            setReportError(null);
            void fetchServerProfitReport({
              mode,
              year: yearNum,
              from: fromDate || undefined,
              to: toDate || undefined,
              productId: productId || undefined,
            })
              .then(setServerReport)
              .catch((reason: unknown) => {
                setServerReport(null);
                setReportError(
                  userFacingError(reason, "Could not load report from server"),
                );
              })
              .finally(() => setReportLoading(false));
          }}
        />
      ) : null}

      {!reportLoading && !reportError && !hasAny ? (
        <EmptyState
          emoji=""
          title="Nothing to show yet"
          hint="Add a purchase or a sale and this page will fill in."
          action={
            <BusinessLink href="/purchases" className="btn-primary">
              + Add Purchase
            </BusinessLink>
          }
        />
      ) : hasAny ? (
        <div className={reportLoading ? "opacity-60" : ""}>
          <div
            role="tablist"
            aria-label="Report sections"
            className="flex w-full sm:w-auto sm:inline-flex gap-1 p-1 mb-2.5 border border-[#E5E5E5] bg-white rounded-[8px]"
          >
            {REPORT_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 sm:flex-none min-h-[44px] px-3 sm:px-6 text-[13px] font-medium rounded-[6px] transition-colors ${
                  tab === t.id
                    ? "bg-[#111] text-white"
                    : "text-[#171717] hover:bg-[#F8F8F7]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-[13px] text-[#171717]/70 mb-5">
            {REPORT_TABS.find((t) => t.id === tab)?.meaning}
          </p>

          {tab === "profit" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start">
              <ProfitLoss report={report} className="!mb-0" />
              <Expenses report={report} className="!mb-0" />
            </div>
          ) : tab === "stock" ? (
            <>
              <StockSummary report={report} />
              <StockCheckPanel report={report} onRecord={openCheck} />
            </>
          ) : tab === "cash" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start">
              <CashPosition report={report} className="!mb-0" />
              <BusinessValue report={report} className="!mb-0" />
            </div>
          ) : (
            <MoneySides report={report} />
          )}
        </div>
      ) : null}

      <Modal
        open={checkOpen}
        onClose={() => setCheckOpen(false)}
        title="Record Stock Count"
        subtitle="Count what is actually in the yard. Do not copy the system figure."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost min-h-[44px]" onClick={() => setCheckOpen(false)}>
              Cancel
            </button>
            <BusyButton type="button" className="min-h-[44px]" onClick={saveCheck} loading={isPending("stock-check:create")}>
              Save count
            </BusyButton>
          </div>
        }
      >
        {!productId ? (
          <label className="block mb-4">
            Product
            <CustomSelect
              className="mt-1"
              value={checkProductId}
              onChange={setCheckProductId}
              options={productOptions.filter((o) => o.value)}
            />
          </label>
        ) : (
          <p className="text-[14px] mb-4">
            <span className="text-[#171717]/70">Product</span>
            <span className="block mt-0.5 font-medium">{checkProduct?.name}</span>
          </p>
        )}
        <label className="block">
          Physical stock{checkProduct ? ` (${qtyUnitLabel(checkProduct.unit)})` : ""}
          <input
            type="number"
            min={0}
            step="0.001"
            value={checkQty}
            onChange={(e) => {
              setCheckQty(e.target.value);
              setCheckError("");
            }}
            className="mt-1"
            aria-invalid={!!checkError}
          />
        </label>
        {checkError ? (
          <p className="mt-2 text-[13px] font-medium text-[#a12b1f]" role="alert">
            {checkError}
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-[#171717]/70">Type what you counted. Do not copy the system number.</p>
        )}
      </Modal>
    </Page>
  );
}
