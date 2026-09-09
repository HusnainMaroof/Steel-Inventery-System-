"use client";

import type { Sale, SaleLine } from "@/lib/types";
import type { BusinessProfile } from "@/lib/auth";
import type { Customer } from "@/lib/types";
import { fmtMoney, fmtQtyWithUnit, fmtRateWithUnit, fmtDate } from "@/lib/format";

export type InvoiceLineDetail = {
  product: string | null;
  category: string | null;
  item: string;
  attributes: { label: string; value: string }[];
};

export default function InvoiceDocument({
  sale,
  customer,
  business,
  subtotal,
  discount,
  discountPct,
  tax,
  taxPct,
  grandTotal,
  paid,
  due,
  lineDetailOf,
}: {
  sale: Sale;
  customer?: Customer;
  business: BusinessProfile;
  subtotal: number;
  discount: number;
  discountPct: number;
  tax: number;
  taxPct: number;
  grandTotal: number;
  paid: number;
  due: number;
  lineDetailOf: (line: SaleLine) => InvoiceLineDetail;
}) {
  const hasAdjustments = discount > 0 || tax > 0;
  const hasDue = due > 0.001;
  const hasPaid = paid > 0.001;

  return (
    <div className="print-area bg-white text-[#171717] max-w-[210mm] mx-auto border border-neutral-200 sm:border-neutral-300 rounded-sm overflow-hidden">
      {/* header */}
      <div className="px-8 sm:px-10 pt-9 pb-6 border-b border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-5">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{business.businessName}</h1>
            <p className="text-[12px] text-neutral-500 mt-2 leading-relaxed">
              {[business.address, business.city].filter(Boolean).join(" · ")}
              {business.phone && (
                <>
                  {(business.address || business.city) && " · "}
                  {business.phone}
                </>
              )}
            </p>
          </div>
          <div className="sm:text-right shrink-0 text-[13px]">
            <p className="text-[10px] uppercase tracking-widest text-neutral-400">Invoice</p>
            <p className="font-bold tabular-nums mt-0.5">{sale.invoiceNo}</p>
            <p className="text-neutral-500 mt-1">{fmtDate(sale.date)}</p>
            {hasDue && (
              <p className="mt-2.5 text-[12px] font-semibold text-[#a12b1f] tabular-nums">
                Due {fmtMoney(due)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* customer */}
      <div className="px-8 sm:px-10 py-4 border-b border-neutral-100">
        <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Customer</p>
        <p className="font-semibold text-[15px]">{customer?.name ?? "—"}</p>
        {(customer?.shop || customer?.phone) && (
          <p className="text-[13px] text-neutral-500 mt-0.5">
            {[customer?.shop, customer?.phone].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {/* items */}
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
            {sale.lines.map((l, i) => {
              const d = lineDetailOf(l);
              const productLine = [d.product, d.category].filter(Boolean).join(" · ");
              return (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="!py-4 !text-[12px] text-neutral-400 align-top">{i + 1}</td>
                  <td className="!py-4 align-top min-w-0">
                    <p className="text-[14px] font-semibold leading-snug">{d.item}</p>
                    {productLine && (
                      <p className="text-[12px] text-neutral-600 mt-1">{productLine}</p>
                    )}
                    {d.attributes.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {d.attributes.map((a) => (
                          <span key={a.label} className="text-[11px] text-neutral-500">
                            <span className="text-neutral-400">{a.label}:</span> {a.value}
                          </span>
                        ))}
                      </div>
                    )}
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
                <span>Discount ({discountPct}%)</span>
                <span className="tabular-nums">− {fmtMoney(discount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between py-2 text-[13px] text-neutral-500 border-b border-neutral-100">
                <span>Tax ({taxPct}%)</span>
                <span className="tabular-nums">{fmtMoney(tax)}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-3 mt-1 border-b border-neutral-100">
              <span className="text-[13px] font-semibold">Total</span>
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

      <div className="px-8 sm:px-10 py-4 border-t border-neutral-100 text-center text-[11px] text-neutral-400">
        Thank you for your business.
      </div>
    </div>
  );
}
