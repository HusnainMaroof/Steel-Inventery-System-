"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore, saleTotal, saleDiscount, saleTax, saleGrandTotal, invoiceStatus } from "@/lib/store";
import { Modal } from "@/components/ui";
import ReceivePaymentModal from "@/components/ReceivePaymentModal";
import { fmtMoney, fmtQtyWithUnit, fmtRateWithUnit, fmtDate } from "@/lib/format";

const statusStyles: Record<string, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-[#f0f7ef] text-[#2e6b2e] border-[#cfe3cd]" },
  partial: { label: "Partially Paid", cls: "bg-[#fdf6e9] text-[#8a5a00] border-[#ecd9b0]" },
  unpaid: { label: "Unpaid", cls: "bg-[#fdf1ef] text-[#a12b1f] border-[#f0d2cc]" },
  advance: { label: "Advance", cls: "bg-[#eef3fb] text-[#1f4e8c] border-[#d2e0f2]" },
};

// shared sale/invoice detail popup — used by the Sales and Invoices tabs
export default function SaleDetailModal({
  saleId,
  onClose,
}: {
  saleId: string | null;
  onClose: () => void;
}) {
  const { sales, customers, suppliers, payments, salePaid } = useStore();
  const [payOpen, setPayOpen] = useState(false);
  const sale = sales.find((s) => s.id === saleId) ?? null;
  if (!sale) return null;
  const cust = customers.find((c) => c.id === sale.customerId);
  const supplierName = (id?: string) =>
    (id && suppliers.find((s) => s.id === id)?.name) || "";
  const total = saleTotal(sale);
  const disc = saleDiscount(sale);
  const tax = saleTax(sale);
  const grand = saleGrandTotal(sale);
  const paid = salePaid(sale.id);
  const due = Math.max(0, grand - paid);
  const status = invoiceStatus(paid, grand);
  const st = statusStyles[status];
  const salePayments = payments.filter(
    (p) => p.type === "customer" && p.saleId === sale.id
  );

  return (
    <Modal open={!!sale} onClose={onClose} title={sale.invoiceNo} size="2xl">
      {/* header — who, when, status */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Customer</span>
          <span className="block font-medium mt-1">{cust?.name ?? sale.customerId}</span>
          <span className="block text-xs text-neutral-400">
            {cust?.shop}
            {cust?.phone ? ` · ${cust.phone}` : ""}
          </span>
        </div>
        <div className="text-right">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md border ${st.cls}`}>
            {st.label}
          </span>
          <span className="block text-xs text-neutral-500 mt-1.5">{fmtDate(sale.date)}</span>
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
            {sale.lines.map((l, i) => (
              <tr key={i}>
                <td className="font-medium">
                  {l.item}
                  {supplierName(l.supplierId) ? (
                    <span className="block text-[10px] text-neutral-400 font-normal">
                      {supplierName(l.supplierId)}
                    </span>
                  ) : null}
                </td>
                <td className="num">{fmtQtyWithUnit(l.qty, l.unit)}</td>
                <td className="num text-neutral-500">{fmtRateWithUnit(l.rate, l.unit)}</td>
                <td className="num">{fmtMoney(l.qty * l.rate)}</td>
              </tr>
            ))}
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
              <td colSpan={3} className="num font-semibold border-b-0 bg-black text-white">
                Total
              </td>
              <td className="num font-semibold border-b-0 bg-black text-white">{fmtMoney(grand)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* balance bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="border border-neutral-200 p-3">
          <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Total</span>
          <span className="block font-medium tabular-nums mt-1">{fmtMoney(grand)}</span>
        </div>
        <div className="border border-neutral-200 p-3">
          <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Paid</span>
          <span className="block font-medium tabular-nums mt-1">{fmtMoney(paid)}</span>
        </div>
        <div className={`p-3 text-white ${due > 0 ? "bg-black" : "bg-neutral-500"}`}>
          <span className="block text-[11px] uppercase tracking-widest text-neutral-300">Due</span>
          <span className="block font-medium tabular-nums mt-1">
            {due > 0 ? fmtMoney(due) : "—"}
          </span>
        </div>
      </div>

      {/* actions */}
      <div className="flex flex-wrap justify-end gap-2 mb-5">
        <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={() => setPayOpen(true)}>
          + Receive Payment
        </button>
        <Link href={`/invoices/${sale.id}`} className="btn-ghost !py-1.5 !px-3 text-xs">
          Print / Save PDF →
        </Link>
      </div>

      {/* payment timeline for this invoice */}
      {salePayments.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">
            Payments on this invoice
          </h3>
          <div className="border border-neutral-200 divide-y divide-neutral-100 max-h-44 overflow-y-auto">
            {salePayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div>
                  <p className="text-sm text-neutral-700">{fmtDate(p.date)} · {p.method}</p>
                  {p.note ? <p className="text-xs text-neutral-400">{p.note}</p> : null}
                </div>
                <span className="text-sm font-medium tabular-nums text-neutral-800">
                  {fmtMoney(p.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ReceivePaymentModal saleId={payOpen ? sale.id : null} onClose={() => setPayOpen(false)} />
    </Modal>
  );
}
