"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore, saleTotal, saleDiscount, saleTax, saleGrandTotal, invoiceStatus } from "@/lib/store";
import { Modal } from "@/components/ui";
import ReceivePaymentModal from "@/components/ReceivePaymentModal";
import { fmtMoney, fmtQtyWithUnit, fmtRateWithUnit, fmtDate, fmtTime } from "@/lib/format";
import { productUsesCategories, resolveDefs } from "@/lib/catalogue";

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
  const { sales, customers, suppliers, payments, inventory, products, categories, variants, attributeDefs, salePaid } = useStore();
  const [payOpen, setPayOpen] = useState(false);
  const sale = sales.find((s) => s.id === saleId) ?? null;
  if (!sale) return null;
  const cust = customers.find((c) => c.id === sale.customerId);
  const supplierName = (id?: string) =>
    (id && suppliers.find((s) => s.id === id)?.name) || "";
  const catNameOf = (l: { categoryId?: string; variantId?: string }) => {
    const variant = l.variantId ? variants.find((v) => v.id === l.variantId) : undefined;
    const catId = l.categoryId ?? variant?.categoryId;
    const cat = catId ? categories.find((c) => c.id === catId) : undefined;
    if (!cat) return "";
    const prod =
      (variant?.productId ? products.find((p) => p.id === variant.productId) : undefined) ??
      products.find((p) => p.id === cat.productId);
    return productUsesCategories(prod) ? cat.name : "";
  };
  const productOf = (item: string) =>
    inventory.find((r) => r.item === item)?.product || "";
  const prodNameOf = (l: { categoryId?: string; item: string; variantId?: string }) => {
    const variant = l.variantId ? variants.find((v) => v.id === l.variantId) : undefined;
    if (variant?.productId) {
      const p = products.find((x) => x.id === variant.productId);
      if (p) return p.name;
    }
    const cat = l.categoryId ? categories.find((c) => c.id === l.categoryId) : undefined;
    const prod = cat ? products.find((p) => p.id === cat.productId) : undefined;
    return prod?.name ?? productOf(l.item);
  };
  const attrRowsOf = (l: { categoryId?: string; variantId?: string; attributeSnapshot?: Record<string, string>; spec?: string; quality?: string }) => {
    if (l.attributeSnapshot) {
      const variant = l.variantId ? variants.find((v) => v.id === l.variantId) : undefined;
      const cat = l.categoryId ? categories.find((c) => c.id === l.categoryId) : undefined;
      const defs = resolveDefs(attributeDefs, {
        productId: variant?.productId ?? cat?.productId,
        categoryId: l.categoryId ?? variant?.categoryId,
        snapshot: l.attributeSnapshot,
      });
      return defs
        .filter((d) => l.attributeSnapshot![d.key])
        .map((d) => ({ label: d.name, value: l.attributeSnapshot![d.key] }));
    }
    return [l.spec, l.quality].filter(Boolean).map((v, i) => ({ label: i === 0 ? "Spec" : "Quality", value: v! }));
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
      size="6xl"
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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="min-w-0">
          {/* header */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5 pb-5 border-b border-neutral-100">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-medium text-black">Customer</span>
              <p className="font-semibold text-[15px] text-black mt-1">{cust?.name ?? sale.customerId}</p>
              <p className="text-[13px] text-black/60 mt-0.5">
                {cust?.shop}
                {cust?.phone ? ` · ${cust.phone}` : ""}
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center text-[12px] font-medium px-2.5 py-1 rounded-md border ${st.cls}`}>
                {st.label}
              </span>
              <p className="text-[12px] text-black/60 mt-2">{fmtTime(sale.createdAt)}</p>
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
                  const prod = prodNameOf(l);
                  const cat = catNameOf(l);
                  const attrs = attrRowsOf(l);
                  return (
                    <tr key={i}>
                      <td className="max-w-[260px]">
                        <span className="block font-semibold text-[13px] text-black truncate">{prod || l.item}</span>
                        {cat && <span className="block text-[11px] text-black/60 truncate">{cat}</span>}
                        {attrs.map((a, j) => (
                          <span key={j} className="block text-[11px] text-black/60 truncate">
                            {a.label}: {a.value}
                          </span>
                        ))}
                        {!l.attributeSnapshot && l.qualityName ? (
                          <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#171717] bg-neutral-100 border border-neutral-300 rounded-sm">
                            {l.qualityName}
                          </span>
                        ) : null}
                        {supplierName(l.supplierId) ? (
                          <span className="block text-[11px] text-black/60 truncate mt-0.5">Source: {supplierName(l.supplierId)}</span>
                        ) : null}
                      </td>
                      <td className="num text-black">{fmtQtyWithUnit(l.qty, l.unit)}</td>
                      <td className="num text-black">{fmtRateWithUnit(l.rate, l.unit)}</td>
                      <td className="num font-medium text-black">{fmtMoney(l.qty * l.rate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* payment timeline */}
          {(explicitPayments.length > 0 || fifoPayments.length > 0) && (
            <div>
              <h3 className="text-[12px] font-medium text-black uppercase tracking-wider mb-2">
                Payments on this invoice
              </h3>
              <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-100 max-h-48 overflow-y-auto">
                {explicitPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13px] text-black">{fmtDate(p.date)} · {p.method}</p>
                      {p.note ? <p className="text-[12px] text-black/60 truncate">{p.note}</p> : null}
                    </div>
                    <span className="shrink-0 text-[13px] font-medium tabular-nums text-black">{fmtMoney(p.amount)}</span>
                  </div>
                ))}
                {fifoPayments.map((p) => (
                  <div key={`fifo-${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 bg-neutral-50">
                    <div className="min-w-0">
                      <p className="text-[13px] text-black">{fmtDate(p.date)} · {p.method}</p>
                      <p className="text-[11px] text-black/60">Applied from unallocated payment</p>
                    </div>
                    <span className="shrink-0 text-[13px] font-medium tabular-nums text-black">{fmtMoney(p.amount)}</span>
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
              <p className="text-[12px] font-medium text-black uppercase tracking-wider">Totals</p>
            </div>
            <div className="p-4 space-y-2.5 text-[13px]">
              <div className="flex justify-between"><span className="text-black">Subtotal</span><span className="tabular-nums font-medium text-black">{fmtMoney(total)}</span></div>
              {disc > 0 && (
                <div className="flex justify-between"><span className="text-black">Discount ({sale.discountPct ?? 0}%)</span><span className="tabular-nums text-black">− {fmtMoney(disc)}</span></div>
              )}
              {tax > 0 && (
                <div className="flex justify-between"><span className="text-black">Tax ({sale.taxPct ?? 0}%)</span><span className="tabular-nums text-black">+ {fmtMoney(tax)}</span></div>
              )}
              {(sale.loadingCharges ?? 0) > 0 && (
                <div className="flex justify-between"><span className="text-black">Loading Charges</span><span className="tabular-nums text-black">+ {fmtMoney(sale.loadingCharges!)}</span></div>
              )}
              {(sale.transportCharges ?? 0) > 0 && (
                <div className="flex justify-between"><span className="text-black">Transport Charges</span><span className="tabular-nums text-black">+ {fmtMoney(sale.transportCharges!)}</span></div>
              )}
              {(sale.labourCharges ?? 0) > 0 && (
                <div className="flex justify-between"><span className="text-black">Labour Cost</span><span className="tabular-nums text-black">+ {fmtMoney(sale.labourCharges!)}</span></div>
              )}
              <div className="flex justify-between items-center pt-2 mt-2 border-t border-neutral-100">
                <span className="font-semibold text-black">Total</span>
                <span className="tabular-nums font-semibold text-[15px] text-black">{fmtMoney(grand)}</span>
              </div>
            </div>
          </div>

          <div className="border border-neutral-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-neutral-200">
              <div className="p-3 text-center">
                <span className="block text-[10px] uppercase tracking-wider font-medium text-black">Total</span>
                <span className="block font-semibold tabular-nums text-[13px] mt-1 text-black">{fmtMoney(grand)}</span>
              </div>
              <div className="p-3 text-center">
                <span className="block text-[10px] uppercase tracking-wider font-medium text-black">Paid</span>
                <span className="block font-semibold tabular-nums text-[13px] mt-1 text-[#2e6b2e]">{fmtMoney(paid)}</span>
              </div>
              <div className={`p-3 text-center ${due > 0 ? "bg-[#171717] text-white" : ""}`}>
                <span className={`block text-[10px] uppercase tracking-wider font-medium ${due > 0 ? "text-white" : "text-black"}`}>Due</span>
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
                <div className="flex justify-between mt-1.5 text-[10px] text-black tabular-nums">
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
