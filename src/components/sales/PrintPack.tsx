"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saleGrandTotal } from "@/lib/store";
import type { Sale } from "@/lib/types";
import { EmptyState } from "@/components/ui";
import PeriodInvoice from "@/components/sales/PeriodInvoice";
import { fmtMoney, MONTHS, periodInvoiceNo } from "@/lib/format";

export default function PrintPack({
  sales,
  salePaid,
}: {
  sales: Sale[];
  salePaid: (saleId: string) => number;
}) {
  const router = useRouter();
  const currentYear = String(new Date().getFullYear());
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
  const years = useMemo(() => {
    const set = new Set(sales.map((s) => s.date.slice(0, 4)));
    set.add(currentYear);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [sales, currentYear]);

  const [period, setPeriod] = useState<"month" | "year">("month");
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);

  const countsByMonth = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of sales) {
      if (s.date.slice(0, 4) !== year) continue;
      const mo = s.date.slice(5, 7);
      m[mo] = (m[mo] ?? 0) + 1;
    }
    return m;
  }, [sales, year]);

  const yearCount = useMemo(
    () => sales.filter((s) => s.date.startsWith(year)).length,
    [sales, year]
  );

  const filtered = useMemo(() => {
    return sales
      .filter((s) => {
        if (s.date.slice(0, 4) !== year) return false;
        if (period === "month" && s.date.slice(5, 7) !== month) return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.invoiceNo.localeCompare(b.invoiceNo));
  }, [sales, year, month, period]);

  const total = filtered.reduce((a, s) => a + saleGrandTotal(s), 0);
  const due = filtered.reduce((a, s) => a + Math.max(0, saleGrandTotal(s) - salePaid(s.id)), 0);

  const periodLabel =
    period === "year"
      ? year
      : MONTHS.find((m) => m.value === month)?.label + " " + year;

  const invoiceNo = period === "year" ? periodInvoiceNo(year) : periodInvoiceNo(year, month);

  const printHref =
    period === "year"
      ? `/sales/print?year=${year}`
      : `/sales/print?year=${year}&month=${month}`;

  const openPrint = () => {
    if (filtered.length === 0) return;
    router.push(printHref);
  };

  return (
    <div>
      <div className="border border-neutral-200 bg-white p-4 sm:p-5 mb-5">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-neutral-400 font-medium">Period</p>
            <div className="flex gap-1 mt-2 p-1 rounded-lg bg-neutral-100 border border-neutral-200 w-fit">
              {(["month", "year"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-3.5 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                    period === p ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  {p === "month" ? "Month" : "Whole year"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="print-year" className="!mb-1.5">Year</label>
            <select
              id="print-year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="!w-auto min-w-[7rem]"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {period === "month" ? (
          <div>
            <p className="text-[11px] uppercase tracking-widest text-neutral-400 font-medium mb-2">Month</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
              {MONTHS.map((m) => {
                const n = countsByMonth[m.value] ?? 0;
                const selected = month === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMonth(m.value)}
                    className={`relative text-left px-3 py-2.5 rounded-md border transition-colors ${
                      selected
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : n > 0
                          ? "border-neutral-200 bg-white hover:border-neutral-400 text-black"
                          : "border-neutral-100 bg-neutral-50 text-neutral-400 hover:border-neutral-300 hover:text-neutral-600"
                    }`}
                  >
                    <span className="block text-[13px] font-medium leading-tight">{m.label}</span>
                    <span className={`block text-[11px] mt-0.5 tabular-nums ${selected ? "text-white/70" : "text-inherit opacity-70"}`}>
                      {n === 0 ? "None" : `${n} invoice${n === 1 ? "" : "s"}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-neutral-500">
            {yearCount === 0
              ? `No invoices recorded in ${year}.`
              : `One invoice covering January through December ${year}.`}
          </p>
        )}
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
          title={`No invoices in ${periodLabel}`}
          hint={
            period === "month"
              ? "Pick another month, or record a sale first."
              : "Pick another year, or record a sale first."
          }
        />
      ) : (
        <PeriodInvoice sales={filtered} title={periodLabel} invoiceNo={invoiceNo} />
      )}
    </div>
  );
}
