"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { CustomSelect, EmptyState, Modal, Page, PageTitle } from "@/components/ui";
import { qtyUnitLabel } from "@/lib/format";
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
  monthOptions,
  yearOptions,
  type ReportMode,
} from "@/lib/profitReport";

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
    supplierBalance,
    stockChecks,
    recordStockCheck,
  } = store;

  const now = useMemo(() => new Date(), []);
  const [mode, setMode] = useState<ReportMode>("month");
  const [monthKey, setMonthKey] = useState(
    () => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [year, setYear] = useState(() => String(now.getFullYear()));
  const [productId, setProductId] = useState("");
  const [checkProductId, setCheckProductId] = useState("");
  const [checkQty, setCheckQty] = useState("");
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkError, setCheckError] = useState("");

  const yearNum = mode === "month" ? Number(monthKey.slice(0, 4)) : Number(year);
  const monthNum = mode === "month" ? Number(monthKey.slice(5, 7)) : undefined;

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
        month: monthNum,
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
        supplierBalance,
        stockChecks,
      }),
    [
      mode,
      yearNum,
      monthNum,
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
      supplierBalance,
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

  const saveCheck = () => {
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
    recordStockCheck({
      date,
      productId: checkProduct.id,
      physicalQty: qty,
    });
    setCheckOpen(false);
  };

  const hasAny = purchases.length > 0 || sales.length > 0;
  const selectCls = "min-w-[10.5rem] [&_button]:min-h-[44px]";

  return (
    <Page>
      <PageTitle title="Profit & Reports" sub={`${report.periodLabel} · ${report.productLabel}`} />

      <div className="flex flex-wrap items-center gap-2 mb-8">
        <CustomSelect
          compact
          className={selectCls}
          ariaLabel="Period"
          value={mode}
          onChange={(v) => {
            const next = v as ReportMode;
            setMode(next);
            if (next === "year") setYear(monthKey.slice(0, 4));
            else if (year === String(now.getFullYear())) {
              setMonthKey(`${year}-${String(now.getMonth() + 1).padStart(2, "0")}`);
            } else {
              setMonthKey(`${year}-01`);
            }
          }}
          options={[
            { value: "month", label: "Monthly" },
            { value: "year", label: "Yearly" },
          ]}
        />
        {mode === "month" ? (
          <CustomSelect
            compact
            className="min-w-[12rem] [&_button]:min-h-[44px]"
            ariaLabel="Month"
            value={monthKey}
            onChange={setMonthKey}
            options={monthOptions(now)}
          />
        ) : (
          <CustomSelect
            compact
            className={selectCls}
            ariaLabel="Year"
            value={year}
            onChange={setYear}
            options={yearOptions(now)}
          />
        )}
        <CustomSelect
          compact
          className="min-w-[12rem] [&_button]:min-h-[44px]"
          ariaLabel="Product"
          value={productId}
          onChange={setProductId}
          options={productOptions}
        />
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
            <Link href="/purchases" className="btn-primary">
              + Add Purchase
            </Link>
          }
        />
      ) : (
        <>
          <StockSummary report={report} />
          <ProfitLoss report={report} />
          <CashPosition report={report} />
          <BusinessValue report={report} />
          <MoneySides report={report} />
          <Expenses report={report} />
          <StockCheckPanel report={report} onRecord={openCheck} />
        </>
      )}

      <Modal
        open={checkOpen}
        onClose={() => setCheckOpen(false)}
        title="Record Stock Check"
        subtitle="Count what is in the yard. Do not copy the system figure."
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
