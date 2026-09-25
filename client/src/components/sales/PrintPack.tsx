"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saleGrandTotal } from "@/lib/store";
import type { Sale } from "@/lib/types";
import { useBusinessHref } from "@/components/BusinessLink";
import { EmptyState } from "@/components/ui";
import { DateRangePicker, formatRangeLabel } from "@/components/ui/date-range-picker";
import { dateInIsoRange } from "@/lib/date-range-filter";
import PeriodInvoice from "@/components/sales/PeriodInvoice";
import { fmtMoney } from "@/lib/format";

function fmtDateOf(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function rangeInvoiceNo(from: string | null, to: string | null) {
  if (from && to) return `INV-${from.replaceAll("-", "")}_${to.replaceAll("-", "")}`;
  if (from) return `INV-FROM-${from.replaceAll("-", "")}`;
  if (to) return `INV-UNTIL-${to.replaceAll("-", "")}`;
  return "INV-ALL";
}

export function rangeTitle(from: string | null, to: string | null) {
  return formatRangeLabel(from, to, "All dates");
}

export default function PrintPack({
  sales,
  salePaid,
}: {
  sales: Sale[];
  salePaid: (saleId: string) => number;
}) {
  const router = useRouter();
  const businessHref = useBusinessHref();
  const [range, setRange] = useState<{ from: string | null; to: string | null }>({
    from: null,
    to: null,
  });
  const { from, to } = range;

  const filtered = useMemo(() => {
    return sales
      .filter((s) => dateInIsoRange(s.date, { from, to }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.invoiceNo.localeCompare(b.invoiceNo));
  }, [sales, from, to]);

  const total = filtered.reduce((a, s) => a + saleGrandTotal(s), 0);
  const due = filtered.reduce((a, s) => a + Math.max(0, saleGrandTotal(s) - salePaid(s.id)), 0);

  const title = rangeTitle(from, to);
  const invoiceNo = rangeInvoiceNo(from, to);

  const printHref = businessHref(
    `/sales/print?${new URLSearchParams({
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    }).toString()}`,
  );

  const openPrint = () => {
    if (filtered.length === 0) return;
    router.push(printHref);
  };

  return (
    <div>
      <div className="border border-neutral-200 bg-white p-4 sm:p-5 mb-5">
        <p className="text-[11px] uppercase tracking-widest text-neutral-400 font-medium mb-2">Period</p>
        <DateRangePicker
          from={from}
          to={to}
          onChange={setRange}
          placeholder="All dates"
          ariaLabel="Pick invoice date range"
        />
        <p className="mt-2 text-[13px] text-neutral-500">
          {filtered.length} invoice{filtered.length === 1 ? "" : "s"} in {title.toLowerCase()}
        </p>
      </div>

      <div className="border border-neutral-200 bg-white p-4 mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-8">
          <div>
            <span className="block text-[11px] uppercase tracking-widest text-black font-medium">Invoices</span>
            <span className="block text-2xl font-bold tabular-nums text-black mt-1">{filtered.length}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-widest text-black font-medium">Total billed</span>
            <span className="block text-2xl font-bold tabular-nums text-black mt-1">{fmtMoney(total)}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-widest text-black font-medium">Outstanding</span>
            <span className={`block text-2xl font-bold tabular-nums mt-1 ${due > 0 ? "text-[#a12b1f]" : "text-black"}`}>
              {fmtMoney(due)}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={openPrint}
          disabled={filtered.length === 0}
        >
          Print invoice
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={`No invoices in ${title}`}
          hint="Pick another date range, or record a sale first."
        />
      ) : (
        <PeriodInvoice sales={filtered} title={title} invoiceNo={invoiceNo} />
      )}
    </div>
  );
}
