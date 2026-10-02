"use client";

import { Suspense, useEffect, useMemo } from "react";
import { BusinessLink } from "@/components/BusinessLink";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import PeriodInvoice from "@/components/sales/PeriodInvoice";
import { rangeInvoiceNo, rangeTitle } from "@/components/sales/PrintPack";

function BatchPrintInner() {
  const params = useSearchParams();
  const from = params.get("from");
  const to = params.get("to");
  const { sales } = useStore();

  const list = useMemo(() => {
    return sales
      .filter((s) => {
        if (from && s.date < from) return false;
        if (to && s.date > to) return false;
        return !!(from || to);
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.invoiceNo.localeCompare(b.invoiceNo));
  }, [sales, from, to]);

  const title = rangeTitle(from, to);
  const invoiceNo = rangeInvoiceNo(from, to);

  useEffect(() => {
    if (list.length === 0) return;
    const t = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(t);
  }, [list.length, from, to]);

  if (!from && !to) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <p className="text-neutral-500">Pick a date range from Sales first.</p>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-3">
        <p className="text-neutral-500">No sales on {title}.</p>
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
          <p className="text-neutral-500">Preparing sales...</p>
        </div>
      }
    >
      <BatchPrintInner />
    </Suspense>
  );
}
