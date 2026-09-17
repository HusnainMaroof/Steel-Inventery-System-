"use client";

import { Suspense, useEffect, useMemo } from "react";
import { BusinessLink } from "@/components/BusinessLink";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import PeriodInvoice from "@/components/sales/PeriodInvoice";
import { MONTHS, periodInvoiceNo } from "@/lib/format";

function BatchPrintInner() {
  const params = useSearchParams();
  const year = params.get("year") ?? "";
  const month = params.get("month");
  const { sales } = useStore();

  const list = useMemo(() => {
    return sales
      .filter((s) => {
        if (year && s.date.slice(0, 4) !== year) return false;
        if (month && s.date.slice(5, 7) !== month) return false;
        return !!(year || month);
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.invoiceNo.localeCompare(b.invoiceNo));
  }, [sales, year, month]);

  const monthName = MONTHS.find((m) => m.value === month)?.label;
  const title = month && year ? `${monthName} ${year}` : year ? year : "Invoices";
  const invoiceNo = periodInvoiceNo(year, month);

  useEffect(() => {
    if (list.length === 0) return;
    const t = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(t);
  }, [list.length, year, month]);

  if (!year) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <p className="text-neutral-500">Pick a month or year from Sales first.</p>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-3">
        <p className="text-neutral-500">No invoices in {title}.</p>
        <BusinessLink href="/sales?tab=print" className="text-[13px] text-neutral-500 hover:text-black underline-offset-2 hover:underline">
          ← Back to sales
        </BusinessLink>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f8f7] py-4 sm:py-8 px-4 sm:px-6">
      <div className="max-w-[210mm] mx-auto flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-6 no-print">
        <BusinessLink href="/sales?tab=print" className="text-[13px] text-neutral-500 hover:text-black underline-offset-2 hover:underline">
          ← Back to sales
        </BusinessLink>
        <div className="flex items-center gap-3">
          <p className="text-[13px] text-neutral-500">
            {title} · {list.length} sale{list.length === 1 ? "" : "s"}
          </p>
          <button type="button" className="btn-primary !py-2.5 !px-5" onClick={() => window.print()}>
            Print / Save PDF
          </button>
        </div>
      </div>

      <PeriodInvoice sales={list} title={title} invoiceNo={invoiceNo} />
    </div>
  );
}

export default function BatchPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-8">
          <p className="text-neutral-500">Preparing invoice…</p>
        </div>
      }
    >
      <BatchPrintInner />
    </Suspense>
  );
}
