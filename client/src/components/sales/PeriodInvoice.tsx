"use client";

import { useMemo } from "react";
import type { Sale } from "@/lib/types";
import { useBusinessProfile } from "@/lib/auth";
import {
  useStore,
  saleTotal,
  saleDiscount,
  saleTax,
  saleGrandTotal,
} from "@/lib/store";
import { invoiceLineDetail } from "@/lib/invoiceDetail";
import { fmtMoney, fmtQtyWithUnit, fmtRateWithUnit, fmtDate } from "@/lib/format";
import { InvoiceBrandHeader } from "@/components/invoice/InvoiceBrandHeader";
import Decimal from "decimal.js";
import { toDecimal } from "../../lib/decimal";

export default function PeriodInvoice({
  sales,
  title,
  invoiceNo,
}: {
  sales: Sale[];
  title: string;
  invoiceNo: string;
}) {
  const business = useBusinessProfile();
  const { customers, products, categories, variants, attributeDefs, salePaid } = useStore();
  const ctx = useMemo(
    () => ({ products, categories, variants, attributeDefs }),
    [products, categories, variants, attributeDefs]
  );

  const dates = sales.map((s) => s.date).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];
  const dateLabel =
    from && to && from !== to ? `${fmtDate(from)} to ${fmtDate(to)}` : from ? fmtDate(from) : title;

  const subtotal = sales.reduce((a, s) => a.plus(toDecimal(saleTotal(s))), new Decimal(0)).toNumber();
  const discount = sales.reduce((a, s) => a.plus(toDecimal(saleDiscount(s))), new Decimal(0)).toNumber();
  const tax = sales.reduce((a, s) => a.plus(toDecimal(saleTax(s))), new Decimal(0)).toNumber();
  const loadingCharges = sales.reduce((a, s) => a.plus(toDecimal((s.loadingCharges ?? 0))), new Decimal(0)).toNumber();
  const transportCharges = sales.reduce((a, s) => a.plus(toDecimal((s.transportCharges ?? 0))), new Decimal(0)).toNumber();
  const labourCharges = sales.reduce((a, s) => a.plus(toDecimal((s.labourCharges ?? 0))), new Decimal(0)).toNumber();
  const grandTotal = sales.reduce((a, s) => a.plus(toDecimal(saleGrandTotal(s))), new Decimal(0)).toNumber();
  const paid = sales.reduce((a, s) => a.plus(toDecimal(salePaid(s.id))), new Decimal(0)).toNumber();
  const due = sales
    .reduce(
      (a, s) =>
        a.plus(Decimal.max(0, toDecimal(saleGrandTotal(s)).minus(toDecimal(salePaid(s.id))))),
      new Decimal(0),
    )
    .toNumber();

  const hasAdjustments = discount > 0 || tax > 0;
  const hasPaid = paid > 0.001;
  const hasDue = due > 0.001;
  const uniqueCustomers = new Set(sales.map((s) => s.customerId)).size;
  const groups = useMemo(() => {
    let n = 0;
    return sales.map((sale) => ({
      sale,
      lines: sale.lines.map((line) => ({ line, no: ++n })),
    }));
  }, [sales]);

  return (
    <div className="print-area print-flow bg-white text-[#171717] max-w-[210mm] mx-auto border border-[#E5E5E5] rounded-xl overflow-hidden">
      <div className="px-5 sm:px-8 pt-7 pb-5 border-b border-[#E5E5E5]">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-5">
          <InvoiceBrandHeader business={business} />
          <div className="sm:text-right shrink-0 text-[13px]">
            <p className="text-xs uppercase tracking-widest text-[#171717]/50">Invoice</p>
            <p className="font-semibold tabular-nums mt-0.5">{invoiceNo}</p>
            <p className="text-[#171717]/70 mt-1">{title}</p>
            <p className="text-[#171717]/70 mt-0.5">{dateLabel}</p>
            {hasDue && (
              <p className="mt-2.5 text-[13px] font-semibold text-destructive tabular-nums">
                Due {fmtMoney(due)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-8 py-4 border-b border-[#E5E5E5]">
        <p className="text-xs uppercase tracking-wide text-[#171717]/60 mb-1">Period</p>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-[13px] text-[#171717]/70 mt-0.5">
          {sales.length} invoice{sales.length === 1 ? "" : "s"}
          {" · "}
          {uniqueCustomers} customer{uniqueCustomers === 1 ? "" : "s"}
        </p>
      </div>

      <div className="px-5 sm:px-8 py-6">
        <table className="w-full !border-collapse">
          <thead>
            <tr className="border-b border-[#E5E5E5]">
              <th className="text-left text-xs font-medium uppercase tracking-wide text-[#171717]/60 pb-2.5 w-8">#</th>
              <th className="text-left text-xs font-medium uppercase tracking-wide text-[#171717]/60 pb-2.5">Item</th>
              <th className="text-right text-xs font-medium uppercase tracking-wide text-[#171717]/60 pb-2.5 w-24">Qty</th>
              <th className="text-right text-xs font-medium uppercase tracking-wide text-[#171717]/60 pb-2.5 w-28">Rate</th>
              <th className="text-right text-xs font-medium uppercase tracking-wide text-[#171717]/60 pb-2.5 w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ sale, lines }) => {
              const cust = customers.find((c) => c.id === sale.customerId);
              const billed = saleGrandTotal(sale);
              const got = salePaid(sale.id);
              const remain = Decimal.max(0, toDecimal(billed).minus(toDecimal(got))).toNumber();
              return (
                <SaleGroup
                  key={sale.id}
                  sale={sale}
                  lines={lines}
                  customerName={cust?.name ?? "-"}
                  customerDetail={[cust?.shop, cust?.phone].filter(Boolean).join(" · ")}
                  remain={remain}
                  lineDetailOf={(l) => invoiceLineDetail(l, ctx)}
                />
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-end mt-8">
          <div className="w-full sm:w-72">
            {hasAdjustments && (
              <div className="flex justify-between py-2 text-sm text-[#171717]/70 border-b border-[#E5E5E5]">
                <span>Subtotal</span>
                <span className="tabular-nums">{fmtMoney(subtotal)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between py-2 text-sm text-[#171717]/70 border-b border-[#E5E5E5]">
                <span>Discount</span>
                <span className="tabular-nums">− {fmtMoney(discount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between py-2 text-sm text-[#171717]/70 border-b border-[#E5E5E5]">
                <span>Tax</span>
                <span className="tabular-nums">{fmtMoney(tax)}</span>
              </div>
            )}
            <div className="mt-3 rounded-lg bg-[#FAFAF9] overflow-hidden">
              <p className="px-3 pt-2.5 pb-1.5 text-xs font-medium uppercase tracking-wide text-[#171717]/60 border-b border-[#E5E5E5]">
                Charges
              </p>
              <div className="px-3 py-2 space-y-1.5">
                {[
                  { label: "Loading Charges", value: loadingCharges },
                  { label: "Transport Charges", value: transportCharges },
                  { label: "Labour Cost", value: labourCharges },
                ].map((c) => (
                  <div key={c.label} className="flex justify-between text-sm text-[#171717]/70">
                    <span>{c.label}</span>
                    <span className={`tabular-nums ${c.value > 0 ? "font-semibold text-[#171717]" : "text-[#171717]/50"}`}>
                      {c.value > 0 ? `+ ${fmtMoney(c.value)}` : "-"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center py-3 px-3 mt-3 bg-[#171717] text-white rounded-lg">
              <span className="text-xs uppercase tracking-wide text-white/60 font-medium">Total</span>
              <span className="text-lg font-bold tabular-nums">{fmtMoney(grandTotal)}</span>
            </div>
            {hasPaid && (
              <div className="flex justify-between items-center py-2 text-sm text-[#171717]/70">
                <span>Paid</span>
                <span className="tabular-nums font-semibold text-success">{fmtMoney(paid)}</span>
              </div>
            )}
            {hasDue ? (
              <div className="flex justify-between items-center py-3 px-3 mt-1 rounded-lg bg-destructive/10">
                <span className="text-sm font-semibold text-destructive">Amount due</span>
                <span className="text-base font-bold tabular-nums text-destructive">{fmtMoney(due)}</span>
              </div>
            ) : grandTotal > 0 ? (
              <div className="flex justify-between items-center py-2 text-sm text-success">
                <span className="font-medium">Balance</span>
                <span className="font-semibold">Paid in full</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-8 py-4 border-t border-[#E5E5E5] text-center text-[13px] text-[#171717]/70">
        {business.invoiceNote || "Thank you for your business."}
      </div>
    </div>
  );
}

function SaleGroup({
  sale,
  lines,
  customerName,
  customerDetail,
  remain,
  lineDetailOf,
}: {
  sale: Sale;
  lines: { line: Sale["lines"][number]; no: number }[];
  customerName: string;
  customerDetail: string;
  remain: number;
  lineDetailOf: (line: Sale["lines"][number]) => ReturnType<typeof invoiceLineDetail>;
}) {
  return (
    <>
      <tr className="border-b border-[#E5E5E5] bg-[#FAFAF9]">
        <td colSpan={4} className="py-3 align-top">
          <p className="text-[13px] tabular-nums text-[#171717]/60">
            {sale.invoiceNo} · {fmtDate(sale.date)}
          </p>
          <p className="text-sm font-semibold text-[#171717] mt-0.5">{customerName}</p>
          {customerDetail && (
            <p className="text-[13px] text-[#171717]/70 mt-0.5">{customerDetail}</p>
          )}
        </td>
        <td className="py-3 text-right align-top whitespace-nowrap">
          {remain > 0.001 ? (
            <span className="text-xs font-semibold text-destructive tabular-nums">Due {fmtMoney(remain)}</span>
          ) : (
            <span className="text-xs font-semibold text-success">Paid</span>
          )}
        </td>
      </tr>
      {lines.map(({ line: l, no }) => {
        const d = lineDetailOf(l);
        const amount = toDecimal(l.qty).times(toDecimal(l.rate)).toNumber();
        return (
          <tr key={`${sale.id}-${no}`} className="border-b border-[#E5E5E5]">
            <td className="py-4 text-xs text-[#171717]/50 align-top">{no}</td>
            <td className="py-4 align-top min-w-0">
              <p className="text-sm font-semibold leading-snug">{d.product ?? d.item}</p>
              {d.category && (
                <p className="text-[13px] text-[#171717]/70 mt-0.5">{d.category}</p>
              )}
              {d.attributes.length > 0 ? (
                <div className="mt-1">
                  {d.attributes.map((a) => (
                    <p key={a.label} className="text-[13px] text-[#171717]/60 leading-relaxed">
                      {a.label}: {a.value}
                    </p>
                  ))}
                </div>
              ) : d.qualityName ? (
                <span className="inline-block mt-1.5 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-[#171717] bg-[#FAFAF9] border border-[#E5E5E5] rounded-md">
                  {d.qualityName}
                </span>
              ) : null}
            </td>
            <td className="py-4 text-right align-top text-sm tabular-nums whitespace-nowrap">
              {fmtQtyWithUnit(l.qty, l.unit)}
            </td>
            <td className="py-4 text-right align-top text-sm tabular-nums text-[#171717]/70 whitespace-nowrap">
              {fmtRateWithUnit(l.rate, l.unit)}
            </td>
            <td className="py-4 text-right align-top text-sm font-semibold tabular-nums whitespace-nowrap">
              {fmtMoney(amount)}
            </td>
          </tr>
        );
      })}
    </>
  );
}
