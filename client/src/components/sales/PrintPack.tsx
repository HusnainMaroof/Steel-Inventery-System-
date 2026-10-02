"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saleGrandTotal } from "@/lib/store";
import type { Sale } from "@/lib/types";
import { useBusinessHref } from "@/components/BusinessLink";
import { EmptyState } from "@/components/ui";
import { DateRangePicker, formatRangeLabel } from "@/components/ui/date-range-picker";
import { dateInIsoRange, todayIsoDay } from "@/lib/date-range-filter";
import PeriodInvoice from "@/components/sales/PeriodInvoice";
import { fmtMoney } from "@/lib/format";

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
  const today = todayIsoDay();
  const [range, setRange] = useState<{ from: string | null; to: string | null }>({
    from: today,
    to: today,
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
    <div className="max-w-[210mm]">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DateRangePicker
          from={from}
          to={to}
          onChange={setRange}
          placeholder="Today"
          ariaLabel="Pick sales date"
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
          <span className="tabular-nums text-neutral-700">
            <span className="font-semibold text-neutral-900">{filtered.length}</span> sale{filtered.length === 1 ? "" : "s"}
          </span>
          <span className="tabular-nums text-neutral-700">{fmtMoney(total)}</span>
          <span className={`tabular-nums font-medium ${due > 0 ? "text-[#a12b1f]" : "text-neutral-700"}`}>
            Due {fmtMoney(due)}
          </span>
          <button
            type="button"
            className="btn-primary !py-2 !px-4 text-[13px]"
            onClick={openPrint}
            disabled={filtered.length === 0}
          >
            Print
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={`No sales on ${title}`}
          hint="Pick another date, or record a sale first."
        />
      ) : (
        <PeriodInvoice sales={filtered} title={title} invoiceNo={invoiceNo} />
      )}
    </div>
  );
}
