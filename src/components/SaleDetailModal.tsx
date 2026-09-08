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
  const { sales, customers, suppliers, payments, inventory, salePaid } = useStore();
  const [payOpen, setPayOpen] = useState(false);
  const sale = sales.find((s) => s.id === saleId) ?? null;
  if (!sale) return null;
  const cust = customers.find((c) => c.id === sale.customerId);
  const supplierName = (id?: string) =>
    (id && suppliers.find((s) => s.id === id)?.name) || "";
  const productOf = (item: string) =>
    inventory.find((r) => r.item === item)?.product || "";
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
  // reconstruct which unallocated payments were FIFO-allocated to this invoice
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
    <Modal open={!!sale} onClose={onClose} title={sale.invoiceNo} size="2xl">
      {/* header — who, when, status */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Customer</span>
          <span className="block font-semibold text-base mt-1">{cust?.name ?? sale.customerId}</span>
          <span className="block text-xs text-neutral-400">
            {cust?.shop}
            {cust?.phone ? ` · ${cust.phone}` : ""}
          </span>
        </div>
        <div className="text-right">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md border ${st.cls}`}>
            {st.label}
          </span>
          <span className="block text-xs text-neutral-500 mt-1.5">{fmtDate(sale.date)} · {fmtTime(sale.createdAt)}</span>
        </div>
      </div>

      {/* items */}
      <div className="border border-neutral-200 mb-4">
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
              const source = [productOf(l.item), l.spec, supplierName(l.supplierId)].filter(Boolean).join(" · ");
              return (
                <tr key={i}>
                  <td className="font-medium">
                    {l.item}
                    {source ? (
                      <span className="block text-[10px] text-neutral-400 font-normal">
                        {source}
                      </span>
                    ) : null}
                  </td>
                  <td className="num">{fmtQtyWithUnit(l.qty, l.unit)}</td>
                  <td className="num text-neutral-500">{fmtRateWithUnit(l.rate, l.unit)}</td>
                  <td className="num">{fmtMoney(l.qty * l.rate)}</td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={3} className="num font-medium border-b-0">
                Subtotal
              </td>
              <td className="num font-medium border-b-0">{fmtMoney(total)}</td>
            </tr>
            {disc > 0 && (
              <tr>
                <td colSpan={3} className="num text-neutral-500 border-b-0">
                  Discount ({(sale.discountPct ?? 0)}%)
                </td>
                <td className="num text-neutral-500 border-b-0">− {fmtMoney(disc)}</td>
              </tr>
            )}
            {tax > 0 && (
              <tr>
                <td colSpan={3} className="num text-neutral-500 border-b-0">
                  Tax ({(sale.taxPct ?? 0)}%)
                </td>
                <td className="num text-neutral-500 border-b-0">+ {fmtMoney(tax)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={3} className="num font-semibold border-b-0 bg-black">
                <span className="text-white">Total</span>
              </td>
              <td className="num font-semibold border-b-0 bg-black">
                <span className="text-white">{fmtMoney(grand)}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* balance panel */}
      <div className="border border-neutral-200 mb-4">
        <div className="grid grid-cols-3">
          <div className="p-3 border-r border-neutral-200">
            <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Total</span>
            <span className="block font-semibold tabular-nums mt-1">{fmtMoney(grand)}</span>
          </div>
          <div className="p-3 border-r border-neutral-200">
            <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Paid</span>
            <span className="block font-semibold tabular-nums mt-1 text-[#2e6b2e]">{fmtMoney(paid)}</span>
          </div>
          <div className={`p-3 ${due > 0 ? "bg-black text-white" : ""}`}>
            <span className={`block text-[11px] uppercase tracking-widest ${due > 0 ? "text-neutral-300" : "text-neutral-500"}`}>Due</span>
            <span className="block font-semibold tabular-nums mt-1">
              {due > 0 ? fmtMoney(due) : <span className={due > 0 ? "" : "text-[#2e6b2e]"}>—</span>}
            </span>
          </div>
        </div>
        {/* paid progress */}
        {grand > 0 && (
          <div className="px-3 pb-3">
            <div className="h-1.5 w-full bg-neutral-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${due > 0 ? "bg-black" : "bg-[#2e6b2e]"}`}
                style={{ width: `${paidPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-neutral-400 tabular-nums">
              <span>{due > 0 ? "Partially paid" : "Fully paid"}</span>
              <span>{Math.round(paidPct)}% paid</span>
            </div>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Link href={`/sales/${sale.id}`} className="btn-ghost !py-1.5 !px-3 text-xs">
          Print / Save PDF →
        </Link>
        {due > 0 && (
          <button onClick={() => setPayOpen(true)} className="btn-primary !py-1.5 !px-3 text-xs">
            Receive Payment
          </button>
        )}
      </div>

      {/* payment timeline for this invoice */}
      {(explicitPayments.length > 0 || fifoPayments.length > 0) && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">
            Payments on this invoice
          </h3>
          <div className="border border-neutral-200 divide-y divide-neutral-100 max-h-44 overflow-y-auto">
            {explicitPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-700">{fmtDate(p.date)} <span className="text-neutral-300">·</span> <span className="text-neutral-500">{p.method}</span></p>
                  {p.note ? <p className="text-xs text-neutral-400 truncate">{p.note}</p> : null}
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-neutral-800">
                  {fmtMoney(p.amount)}
                </span>
              </div>
            ))}
            {fifoPayments.map((p) => (
              <div key={`fifo-${p.id}`} className="flex items-center justify-between gap-3 px-3 py-2 bg-neutral-50">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-700">{fmtDate(p.date)} <span className="text-neutral-300">·</span> <span className="text-neutral-500">{p.method}</span></p>
                  <p className="text-[10px] text-neutral-400">Applied from unallocated payment</p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-neutral-800">
                  {fmtMoney(p.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* nested receive-payment popup */}
      <ReceivePaymentModal saleId={payOpen ? sale.id : null} onClose={() => setPayOpen(false)} />
    </Modal>
  );
}
