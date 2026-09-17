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
    from && to && from !== to ? `${fmtDate(from)} – ${fmtDate(to)}` : from ? fmtDate(from) : title;

  const subtotal = sales.reduce((a, s) => a + saleTotal(s), 0);
  const discount = sales.reduce((a, s) => a + saleDiscount(s), 0);
  const tax = sales.reduce((a, s) => a + saleTax(s), 0);
  const loadingCharges = sales.reduce((a, s) => a + (s.loadingCharges ?? 0), 0);
  const transportCharges = sales.reduce((a, s) => a + (s.transportCharges ?? 0), 0);
  const labourCharges = sales.reduce((a, s) => a + (s.labourCharges ?? 0), 0);
  const grandTotal = sales.reduce((a, s) => a + saleGrandTotal(s), 0);
  const paid = sales.reduce((a, s) => a + salePaid(s.id), 0);
  const due = sales.reduce((a, s) => a + Math.max(0, saleGrandTotal(s) - salePaid(s.id)), 0);

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
    <div className="print-area print-flow bg-white text-[#171717] max-w-[210mm] mx-auto border border-neutral-200 sm:border-neutral-300 rounded-sm overflow-hidden">
      <div className="px-8 sm:px-10 pt-9 pb-6 border-b border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-5">
          <InvoiceBrandHeader business={business} />
          <div className="sm:text-right shrink-0 text-[13px]">
            <p className="text-[10px] uppercase tracking-widest text-neutral-400">Invoice</p>
            <p className="font-bold tabular-nums mt-0.5">{invoiceNo}</p>
            <p className="text-neutral-500 mt-1">{title}</p>
            <p className="text-neutral-500 mt-0.5">{dateLabel}</p>
            {hasDue && (
              <p className="mt-2.5 text-[12px] font-semibold text-[#a12b1f] tabular-nums">
                Due {fmtMoney(due)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 sm:px-10 py-4 border-b border-neutral-100">
        <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Period</p>
        <p className="font-semibold text-[15px]">{title}</p>
        <p className="text-[13px] text-neutral-500 mt-0.5">
          {sales.length} invoice{sales.length === 1 ? "" : "s"}
          {" · "}
          {uniqueCustomers} customer{uniqueCustomers === 1 ? "" : "s"}
        </p>
      </div>

      <div className="px-8 sm:px-10 py-6">
        <table className="w-full !border-collapse">
          <thead>
            <tr className="border-b border-neutral-300">
              <th className="!text-left !text-[10px] !uppercase !tracking-wider !text-neutral-400 !font-medium !pb-2.5 !w-8">#</th>
              <th className="!text-left !text-[10px] !uppercase !tracking-wider !text-neutral-400 !font-medium !pb-2.5">Item</th>
              <th className="!text-right !text-[10px] !uppercase !tracking-wider !text-neutral-400 !font-medium !pb-2.5 !w-24">Qty</th>
              <th className="!text-right !text-[10px] !uppercase !tracking-wider !text-neutral-400 !font-medium !pb-2.5 !w-28">Rate</th>
              <th className="!text-right !text-[10px] !uppercase !tracking-wider !text-neutral-400 !font-medium !pb-2.5 !w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ sale, lines }) => {
              const cust = customers.find((c) => c.id === sale.customerId);
              const billed = saleGrandTotal(sale);
              const got = salePaid(sale.id);
              const remain = Math.max(0, billed - got);
              return (
                <SaleGroup
                  key={sale.id}
                  sale={sale}
                  lines={lines}
                  customerName={cust?.name ?? "—"}
                  customerDetail={[cust?.shop, cust?.phone].filter(Boolean).join(" · ")}
                  remain={remain}
                  lineDetailOf={(l) => invoiceLineDetail(l, ctx)}
                />
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-end mt-8">
          <div className="w-full sm:w-64">
            {hasAdjustments && (
              <div className="flex justify-between py-2 text-[13px] text-neutral-500 border-b border-neutral-100">
                <span>Subtotal</span>
                <span className="tabular-nums">{fmtMoney(subtotal)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between py-2 text-[13px] text-neutral-500 border-b border-neutral-100">
                <span>Discount</span>
                <span className="tabular-nums">− {fmtMoney(discount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between py-2 text-[13px] text-neutral-500 border-b border-neutral-100">
                <span>Tax</span>
                <span className="tabular-nums">{fmtMoney(tax)}</span>
              </div>
            )}
            <div className="mt-3 border border-neutral-300 bg-neutral-50 rounded-md overflow-hidden">
              <p className="px-3 pt-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500 border-b border-neutral-200">
                Charges
              </p>
              <div className="px-3 py-2 space-y-1.5">
                {[
                  { label: "Loading Charges", value: loadingCharges },
                  { label: "Transport Charges", value: transportCharges },
                  { label: "Labour Cost", value: labourCharges },
                ].map((c) => (
                  <div key={c.label} className="flex justify-between text-[13px] text-neutral-700">
                    <span>{c.label}</span>
                    <span className={`tabular-nums ${c.value > 0 ? "font-semibold" : "text-neutral-400"}`}>
                      {c.value > 0 ? `+ ${fmtMoney(c.value)}` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center py-3 px-3 mt-3 bg-[#171717] text-white rounded-sm">
              <span className="text-[12px] uppercase tracking-widest text-neutral-400 font-medium">Total</span>
              <span className="text-[18px] font-bold tabular-nums">{fmtMoney(grandTotal)}</span>
            </div>
            {hasPaid && (
              <div className="flex justify-between items-center py-2 text-[13px] text-neutral-600">
                <span>Paid</span>
                <span className="tabular-nums font-medium text-[#2e6b2e]">{fmtMoney(paid)}</span>
              </div>
            )}
            {hasDue ? (
              <div className="flex justify-between items-center py-3 px-3 -mx-3 mt-1 border border-[#f0d2cc] rounded-md bg-[#fdf1ef]">
                <span className="text-[13px] font-semibold text-[#a12b1f]">Amount due</span>
                <span className="text-[16px] font-bold tabular-nums text-[#a12b1f]">{fmtMoney(due)}</span>
              </div>
            ) : grandTotal > 0 ? (
              <div className="flex justify-between items-center py-2 text-[13px] text-[#2e6b2e]">
                <span className="font-medium">Balance</span>
                <span className="font-semibold">Paid in full</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-8 sm:px-10 py-4 border-t border-neutral-100 text-center text-[11px] text-[#171717]/70">
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
      <tr className="border-b border-neutral-200 bg-neutral-50">
        <td colSpan={4} className="!py-3 align-top">
          <p className="text-[11px] tabular-nums text-neutral-500">
            {sale.invoiceNo} · {fmtDate(sale.date)}
          </p>
          <p className="text-[13px] font-semibold text-[#171717] mt-0.5">{customerName}</p>
          {customerDetail && (
            <p className="text-[11px] text-neutral-500 mt-0.5">{customerDetail}</p>
          )}
        </td>
        <td className="!py-3 !text-right align-top whitespace-nowrap">
          {remain > 0.001 ? (
            <span className="text-[12px] font-semibold text-[#a12b1f] tabular-nums">Due {fmtMoney(remain)}</span>
          ) : (
            <span className="text-[12px] font-semibold text-[#2e6b2e]">Paid</span>
          )}
        </td>
      </tr>
      {lines.map(({ line: l, no }) => {
        const d = lineDetailOf(l);
        return (
          <tr key={`${sale.id}-${no}`} className="border-b border-neutral-100">
            <td className="!py-4 !text-[12px] text-neutral-400 align-top">{no}</td>
            <td className="!py-4 align-top min-w-0">
              <p className="text-[14px] font-semibold leading-snug">{d.product ?? d.item}</p>
              {d.category && (
                <p className="text-[12px] text-neutral-600 mt-0.5">{d.category}</p>
              )}
              {d.attributes.length > 0 ? (
                <div className="mt-1">
                  {d.attributes.map((a) => (
                    <p key={a.label} className="text-[11px] text-neutral-500 leading-relaxed">
                      {a.label}: {a.value}
                    </p>
                  ))}
                </div>
              ) : d.qualityName ? (
                <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#171717] bg-neutral-100 border border-neutral-300 rounded-sm">
                  {d.qualityName}
                </span>
              ) : null}
            </td>
            <td className="!py-4 !text-right align-top text-[13px] tabular-nums whitespace-nowrap">
              {fmtQtyWithUnit(l.qty, l.unit)}
            </td>
            <td className="!py-4 !text-right align-top text-[13px] tabular-nums text-neutral-600 whitespace-nowrap">
              {fmtRateWithUnit(l.rate, l.unit)}
            </td>
            <td className="!py-4 !text-right align-top text-[13px] font-semibold tabular-nums whitespace-nowrap">
              {fmtMoney(l.qty * l.rate)}
            </td>
          </tr>
        );
      })}
    </>
  );
}
