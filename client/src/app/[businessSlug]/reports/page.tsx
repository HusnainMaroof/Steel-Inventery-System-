"use client";

import { useMemo, useState } from "react";
import { BusinessLink } from "@/components/BusinessLink";
import { useStore } from "@/lib/store";
import { CustomSelect, EmptyState, Modal, Page } from "@/components/ui";
import { fmtDate, qtyUnitLabel } from "@/lib/format";
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
  yearOptions,
  type ReportMode,
} from "@/lib/profitReport";

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
  } = store;

  const now = useMemo(() => new Date(), []);
  const [tab, setTab] = useState<ReportTab>("profit");
  const [year, setYear] = useState(() => String(now.getFullYear()));
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [productId, setProductId] = useState("");
  const [checkProductId, setCheckProductId] = useState("");
  const [checkQty, setCheckQty] = useState("");
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkError, setCheckError] = useState("");

  const mode: ReportMode = fromDate || toDate ? "range" : !year ? "all" : "year";
  const yearNum = year ? Number(year) : now.getFullYear();

  const productOptions = useMemo(
    () => [
      { value: "", label: "All Products" },
      ...products
        .filter((p) => p.active !== false)
        .map((p) => ({ value: p.id, label: p.name })),
    ],
    [products]
  );

  const report = useMemo(
    () =>
      buildProfitReport({
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
    ]
  );

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
  const selectCls = "min-w-[10.5rem] [&_button]:min-h-[44px]";
  const headerLabel =
    mode === "range"
      ? fromDate && toDate
        ? `${fmtDate(fromDate)} → ${fmtDate(toDate)}`
        : fromDate
          ? `From ${fmtDate(fromDate)}`
          : `Until ${fmtDate(toDate)}`
      : mode === "all"
        ? "All time"
        : year;

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
          className={selectCls}
          ariaLabel="Year"
          value={year}
          onChange={setYear}
          options={[{ value: "", label: "All years" }, ...yearOptions(now)]}
        />
        <CustomSelect
          compact
          className="min-w-[12rem] [&_button]:min-h-[44px]"
          ariaLabel="Product"
          value={productId}
          onChange={setProductId}
          options={productOptions}
        />
        <label className="flex items-center gap-2 min-h-[44px]">
          <span className="text-[10px] uppercase tracking-widest font-medium text-[#171717]/70">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="From date"
            className="!w-auto !py-2 text-xs min-h-[44px]"
          />
        </label>
        <label className="flex items-center gap-2 min-h-[44px]">
          <span className="text-[10px] uppercase tracking-widest font-medium text-[#171717]/70">To</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="To date"
            className="!w-auto !py-2 text-xs min-h-[44px]"
          />
        </label>
        {fromDate || toDate ? (
          <button
            type="button"
            onClick={() => {
              setFromDate("");
              setToDate("");
            }}
            className="btn-ghost !py-2 !px-3 !text-xs min-h-[44px]"
          >
            Clear dates
          </button>
        ) : null}
        <div className="ml-auto shrink-0">
        <ExportMenu
          onExcel={() => downloadReportCsv(report)}
          onPdf={() => printReportPdf(report)}
        />
        </div>
      </div>

      {!hasAny ? (
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
      ) : (
        <>
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
        </>
      )}

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
            <button type="button" className="btn-primary min-h-[44px]" onClick={saveCheck}>
              Save count
            </button>
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
