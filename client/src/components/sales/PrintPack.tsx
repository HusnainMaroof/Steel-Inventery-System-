"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saleGrandTotal } from "@/lib/store";
import type { Sale } from "@/lib/types";
import { useBusinessHref } from "@/components/BusinessLink";
import { EmptyState } from "@/components/ui";
import { DateRangePicker, formatRangeLabel, toISODate } from "@/components/ui/date-range-picker";
import { dateInIsoRange, todayIsoDay, type IsoRange } from "@/lib/date-range-filter";
import PeriodInvoice from "@/components/sales/PeriodInvoice";
import { fmtDate, fmtMoney } from "@/lib/format";
import { CalendarX2 } from "lucide-react";
import Decimal from "decimal.js";
import { toDecimal } from "../../lib/decimal";

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
  // null means "follow the latest day that has sales until the user picks a range".
  const [range, setRange] = useState<IsoRange | null>(null);

  const latestSaleDay = useMemo(() => {
    let latest = "";
    for (const sale of sales) {
      if (sale.date > latest) latest = sale.date;
    }
    return latest || null;
  }, [sales]);

  const defaultDay = latestSaleDay ?? today;
  const { from, to } = range ?? { from: defaultDay, to: defaultDay };

  const filtered = useMemo(() => {
    return sales
      .filter((s) => dateInIsoRange(s.date, { from, to }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.invoiceNo.localeCompare(b.invoiceNo));
  }, [sales, from, to]);

  const total = filtered
    .reduce((a, s) => a.plus(toDecimal(saleGrandTotal(s))), new Decimal(0))
    .toNumber();
  const due = filtered
    .reduce(
      (a, s) =>
        a.plus(Decimal.max(0, toDecimal(saleGrandTotal(s)).minus(toDecimal(salePaid(s.id))))),
      new Decimal(0),
    )
    .toNumber();

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

  const showLatestDay = () => setRange({ from: defaultDay, to: defaultDay });

  const showThisMonth = () => {
    const now = new Date();
    setRange({
      from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    });
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker
            from={from}
            to={to}
            onChange={setRange}
            placeholder="Today"
            ariaLabel="Pick sales date"
          />
          <button type="button" className="btn-ghost" onClick={showLatestDay}>
            Latest day
          </button>
          <button type="button" className="btn-ghost" onClick={showThisMonth}>
            This month
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="tabular-nums text-[#171717]/70">
            <span className="font-semibold text-[#171717]">{filtered.length}</span> sale
            {filtered.length === 1 ? "" : "s"}
          </span>
          <span className="tabular-nums font-semibold text-[#171717]">{fmtMoney(total)}</span>
          <span
            className={`tabular-nums font-semibold ${
              due > 0 ? "text-destructive" : "text-[#171717]"
            }`}
          >
            Due {fmtMoney(due)}
          </span>
          <button
            type="button"
            className="btn-primary"
            onClick={openPrint}
            disabled={filtered.length === 0}
          >
            Print
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarX2 className="size-6" aria-hidden />}
          title={`No sales on ${title}`}
          hint={
            latestSaleDay
              ? `Latest sales day is ${fmtDate(latestSaleDay)}. Pick another date, or record a sale first.`
              : "Pick another date, or record a sale first."
          }
          action={
            latestSaleDay ? (
              <button type="button" className="btn-ghost" onClick={showLatestDay}>
                Show latest sales day
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="w-full max-w-[210mm]">
          <PeriodInvoice sales={filtered} title={title} invoiceNo={invoiceNo} />
        </div>
      )}
    </div>
  );
}
