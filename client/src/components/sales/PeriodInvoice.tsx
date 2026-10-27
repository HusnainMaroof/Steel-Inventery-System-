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
    <div className="print-area print-flow mx-auto max-w-[210mm] overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white text-[#171717] print:max-w-none print:rounded-none print:border-0">
      <div className="border-b border-[#E5E5E5] px-5 pt-7 pb-5 sm:px-8 print:pt-2 print:pb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-5">
          <InvoiceBrandHeader business={business} />
          <div className="shrink-0 text-[13px] sm:text-right">
            <p className="text-[22px] font-bold leading-none tracking-[-0.02em]">Invoice</p>
            <p className="mt-2 font-semibold tabular-nums">{invoiceNo}</p>
            <p className="mt-1 text-[#171717]/70">{title}</p>
            {dateLabel !== title ? <p className="mt-0.5 text-[#171717]/70">Sales {dateLabel}</p> : null}
            <p className="mt-0.5 text-[#171717]/70">
              {sales.length} invoice{sales.length === 1 ? "" : "s"} · {uniqueCustomers} customer{uniqueCustomers === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-8">
        <table className="w-full !border-collapse">
          <thead>
            <tr className="border-b border-[#E5E5E5]">
              <th className="text-left pb-2.5 text-[13px] font-semibold text-[#171717] w-8">#</th>
              <th className="text-left pb-2.5 text-[13px] font-semibold text-[#171717]">Item</th>
              <th className="text-right pb-2.5 text-[13px] font-semibold text-[#171717] w-24">Qty</th>
              <th className="text-right pb-2.5 text-[13px] font-semibold text-[#171717] w-28">Rate</th>
              <th className="text-right pb-2.5 text-[13px] font-semibold text-[#171717] w-28">Amount</th>
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
                  customerDetail={[cust?.shop && cust.shop !== cust.name ? cust.shop : null, cust?.phone].filter(Boolean).join(" · ")}
                  remain={remain}
                  lineDetailOf={(l) => invoiceLineDetail(l, ctx)}
                />
              );
            })}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end break-inside-avoid">
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
            {[
              { label: "Loading charges", value: loadingCharges },
              { label: "Transport charges", value: transportCharges },
              { label: "Labour cost", value: labourCharges },
            ]
              .filter((c) => c.value > 0)
              .map((c) => (
                <div key={c.label} className="flex justify-between border-b border-[#E5E5E5] py-2 text-sm text-[#171717]/70">
                  <span>{c.label}</span>
                  <span className="tabular-nums text-[#171717]">+ {fmtMoney(c.value)}</span>
                </div>
              ))}
            <div className="mt-1 flex items-center justify-between border-t-2 border-[#171717] py-3">
              <span className="text-[15px] font-bold">Total</span>
              <span className="text-lg font-bold tabular-nums">{fmtMoney(grandTotal)}</span>
            </div>
            {hasPaid && (
              <div className="flex items-center justify-between border-t border-[#E5E5E5] py-2 text-sm">
                <span className="text-[#171717]/70">Paid</span>
                <span className="font-semibold tabular-nums text-success">{fmtMoney(paid)}</span>
              </div>
            )}
            {hasDue ? (
              <div className="flex items-center justify-between border-t border-[#E5E5E5] py-2.5">
                <span className="text-sm font-bold text-destructive">Amount due</span>
                <span className="text-base font-bold tabular-nums text-destructive">{fmtMoney(due)}</span>
              </div>
            ) : grandTotal > 0 ? (
              <div className="flex items-center justify-between border-t border-[#E5E5E5] py-2 text-sm text-success">
                <span className="font-medium">Balance</span>
                <span className="font-semibold">Paid in full</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="break-inside-avoid border-t border-[#E5E5E5] px-5 py-4 text-center text-[13px] text-[#171717]/70 sm:px-8 print:py-3">
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
      <tr className="break-inside-avoid border-b border-[#E5E5E5] bg-[#FAFAF9] print:bg-[#F6F6F4]">
        <td colSpan={4} className="py-2.5 pl-2 align-top">
          <p className="text-sm font-semibold text-[#171717]">
            {customerName}
            {customerDetail ? <span className="font-normal text-[#171717]/70"> · {customerDetail}</span> : null}
          </p>
          <p className="mt-0.5 text-[13px] tabular-nums text-[#171717]/70">
            {sale.invoiceNo} · {fmtDate(sale.date)}
          </p>
        </td>
        <td className="py-2.5 pr-2 text-right align-top whitespace-nowrap">
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
          <tr key={`${sale.id}-${no}`} className="break-inside-avoid border-b border-[#E5E5E5]">
            <td className="py-3 pl-2 align-top text-[13px] text-[#171717]/70">{no}</td>
            <td className="min-w-0 py-3 align-top">
              <p className="text-sm font-semibold leading-snug">{d.product ?? d.item}</p>
              {d.category && (
                <p className="text-[13px] text-[#171717]/70 mt-0.5">{d.category}</p>
              )}
              {d.attributes.length > 0 ? (
                <p className="mt-0.5 text-[13px] leading-relaxed text-[#171717]/70">
                  {d.attributes.map((a) => `${a.label}: ${a.value}`).join(" · ")}
                </p>
              ) : d.qualityName ? (
                <p className="mt-0.5 text-[13px] text-[#171717]/70">{d.qualityName}</p>
              ) : null}
            </td>
            <td className="py-3 text-right align-top text-sm tabular-nums whitespace-nowrap">
              {fmtQtyWithUnit(l.qty, l.unit)}
            </td>
            <td className="py-3 text-right align-top text-sm tabular-nums text-[#171717]/70 whitespace-nowrap">
              {fmtRateWithUnit(l.rate, l.unit)}
            </td>
            <td className="py-3 pr-2 text-right align-top text-sm font-semibold tabular-nums whitespace-nowrap">
              {fmtMoney(amount)}
            </td>
          </tr>
        );
      })}
    </>
  );
}
