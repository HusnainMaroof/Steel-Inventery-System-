"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore, saleTotal, saleDiscount, saleTax, saleGrandTotal, invoiceStatus } from "@/lib/store";
import { Modal } from "@/components/ui";
import ReceivePaymentModal from "@/components/ReceivePaymentModal";
import { fmtMoney, fmtQtyWithUnit, fmtRateWithUnit, fmtDate, fmtTime } from "@/lib/format";

const statusStyles: Record<string, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-[#f0f7ef] text-[#2e6b2e] border-[#cfe3cd]" },
  unpaid: { label: "Unpaid", cls: "bg-[#fdf1ef] text-[#a12b1f] border-[#f0d2cc]" },
};

export default function SaleDetailModal({
  saleId,
  onClose,
}: {
  saleId: string | null;
  onClose: () => void;
}) {
  const { sales, customers, suppliers, payments, inventory, products, categories, attributeDefs, salePaid } = useStore();
  const [payOpen, setPayOpen] = useState(false);
  const sale = sales.find((s) => s.id === saleId) ?? null;
  if (!sale) return null;
  const cust = customers.find((c) => c.id === sale.customerId);
  const supplierName = (id?: string) =>
    (id && suppliers.find((s) => s.id === id)?.name) || "";
  const productOf = (item: string) =>
    inventory.find((r) => r.item === item)?.product || "";
  const lineCaption = (l: { categoryId?: string; attributeSnapshot?: Record<string, string>; item: string; spec?: string; quality?: string; supplierId?: string }) => {
    const defs =
      l.categoryId
        ? attributeDefs
            .filter((d) => d.categoryId === l.categoryId && d.active)
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [];
    const cat = l.categoryId ? categories.find((c) => c.id === l.categoryId) : undefined;
    const prod = cat ? products.find((p) => p.id === cat.productId) : undefined;
    const attrs = l.attributeSnapshot
      ? defs.filter((d) => l.attributeSnapshot![d.key]).map((d) => l.attributeSnapshot![d.key])
      : [l.spec, l.quality].filter(Boolean);
    return [prod?.name ?? productOf(l.item), ...attrs, supplierName(l.supplierId)].filter(Boolean).join(" · ");
  };
  const total = saleTotal(sale);
  const disc = saleDiscount(sale);
  const tax = saleTax(sale);
  const grand = saleGrandTotal(sale);
  const paid = salePaid(sale.id);
  const due = Math.max(0, grand - paid);
  const paidPct = grand > 0 ? Math.min(100, (paid / grand) * 100) : 0;
  const status = invoiceStatus(paid, grand);
  const st = statusStyles[status];
  const explicitPayments = payments.filter(
    (p) => p.type === "customer" && p.saleId === sale.id
  );
  const explicitTotal = explicitPayments.reduce((a, p) => a + p.amount, 0);
  const fifoExtra = paid - explicitTotal;
  const fifoPayments: { id: string; date: string; amount: number; method: string; note?: string }[] = [];
  if (fifoExtra > 0.01) {
    const custPayments = payments
      .filter((p) => p.type === "customer" && p.partyId === sale.customerId && !p.saleId)
      .sort((a, b) => a.date.localeCompare(b.date));
    let left = fifoExtra;
    for (const p of custPayments) {
      if (left <= 0.01) break;
      const take = Math.min(p.amount, left);
      fifoPayments.push({ id: p.id, date: p.date, amount: take, method: p.method, note: p.note });
      left -= take;
    }
  }

  return (
    <Modal
      open={!!sale}
      onClose={onClose}
      title={sale.invoiceNo}
      subtitle={`${fmtDate(sale.date)} · ${cust?.name ?? sale.customerId}`}
      size="4xl"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/sales/${sale.id}`} className="btn-ghost !py-2 !px-4 text-[13px]">
            Print / Save PDF
          </Link>
          {due > 0 && (
            <button type="button" onClick={() => setPayOpen(true)} className="btn-primary !py-2 !px-4 text-[13px]">
              Receive Payment
            </button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
        <div className="min-w-0">
          {/* header */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5 pb-5 border-b border-neutral-100">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-neutral-400">Customer</span>
              <p className="font-semibold text-[15px] mt-1">{cust?.name ?? sale.customerId}</p>
              <p className="text-[13px] text-neutral-400 mt-0.5">
                {cust?.shop}
                {cust?.phone ? ` · ${cust.phone}` : ""}
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center text-[12px] font-medium px-2.5 py-1 rounded-md border ${st.cls}`}>
                {st.label}
              </span>
              <p className="text-[12px] text-neutral-400 mt-2">{fmtTime(sale.createdAt)}</p>
            </div>
          </div>

          {/* items table */}
          <div className="border border-neutral-200 rounded-lg overflow-x-auto mb-5">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sale.lines.map((l, i) => {
                  const source = lineCaption(l);
                  return (
                    <tr key={i}>
                      <td className="font-medium max-w-[200px]">
                        <span className="block truncate">{l.item}</span>
                        {source ? (
                          <span className="block text-[11px] text-neutral-400 font-normal truncate">{source}</span>
                        ) : null}
                      </td>
                      <td className="num">{fmtQtyWithUnit(l.qty, l.unit)}</td>
                      <td className="num text-neutral-500">{fmtRateWithUnit(l.rate, l.unit)}</td>
                      <td className="num font-medium">{fmtMoney(l.qty * l.rate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* payment timeline */}
          {(explicitPayments.length > 0 || fifoPayments.length > 0) && (
            <div>
              <h3 className="text-[12px] font-medium text-neutral-500 uppercase tracking-wider mb-2">
                Payments on this invoice
              </h3>
              <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-100 max-h-48 overflow-y-auto">
                {explicitPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13px] text-neutral-700">{fmtDate(p.date)} · {p.method}</p>
                      {p.note ? <p className="text-[12px] text-neutral-400 truncate">{p.note}</p> : null}
                    </div>
                    <span className="shrink-0 text-[13px] font-medium tabular-nums">{fmtMoney(p.amount)}</span>
                  </div>
                ))}
                {fifoPayments.map((p) => (
                  <div key={`fifo-${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 bg-neutral-50">
                    <div className="min-w-0">
                      <p className="text-[13px] text-neutral-700">{fmtDate(p.date)} · {p.method}</p>
                      <p className="text-[11px] text-neutral-400">Applied from unallocated payment</p>
                    </div>
                    <span className="shrink-0 text-[13px] font-medium tabular-nums">{fmtMoney(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* summary sidebar */}
        <div className="space-y-4 lg:sticky lg:top-0">
          <div className="border border-neutral-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50/50">
              <p className="text-[12px] font-medium text-neutral-500 uppercase tracking-wider">Totals</p>
            </div>
            <div className="p-4 space-y-2.5 text-[13px]">
              <div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><span className="tabular-nums font-medium">{fmtMoney(total)}</span></div>
              {disc > 0 && (
                <div className="flex justify-between"><span className="text-neutral-500">Discount ({sale.discountPct ?? 0}%)</span><span className="tabular-nums text-neutral-500">− {fmtMoney(disc)}</span></div>
              )}
              {tax > 0 && (
                <div className="flex justify-between"><span className="text-neutral-500">Tax ({sale.taxPct ?? 0}%)</span><span className="tabular-nums text-neutral-500">+ {fmtMoney(tax)}</span></div>
              )}
              <div className="flex justify-between items-center pt-2 mt-2 border-t border-neutral-100">
                <span className="font-semibold">Total</span>
                <span className="tabular-nums font-semibold text-[15px]">{fmtMoney(grand)}</span>
              </div>
            </div>
          </div>

          <div className="border border-neutral-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-neutral-200">
              <div className="p-3 text-center">
                <span className="block text-[10px] uppercase tracking-wider text-neutral-400">Total</span>
                <span className="block font-semibold tabular-nums text-[13px] mt-1">{fmtMoney(grand)}</span>
              </div>
              <div className="p-3 text-center">
                <span className="block text-[10px] uppercase tracking-wider text-neutral-400">Paid</span>
                <span className="block font-semibold tabular-nums text-[13px] mt-1 text-[#2e6b2e]">{fmtMoney(paid)}</span>
              </div>
              <div className={`p-3 text-center ${due > 0 ? "bg-[#171717] text-white" : ""}`}>
                <span className={`block text-[10px] uppercase tracking-wider ${due > 0 ? "text-neutral-400" : "text-neutral-400"}`}>Due</span>
                <span className="block font-semibold tabular-nums text-[13px] mt-1">
                  {due > 0 ? fmtMoney(due) : <span className="text-[#2e6b2e]">—</span>}
                </span>
              </div>
            </div>
            {grand > 0 && (
              <div className="px-4 pb-3 pt-2">
                <div className="h-1.5 w-full bg-neutral-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${due > 0 ? "bg-[#171717]" : "bg-[#2e6b2e]"}`}
                    style={{ width: `${paidPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-neutral-400 tabular-nums">
                  <span>{due > 0 ? "Partially paid" : "Fully paid"}</span>
                  <span>{Math.round(paidPct)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ReceivePaymentModal saleId={payOpen ? sale.id : null} onClose={() => setPayOpen(false)} />
    </Modal>
  );
}
