"use client";

import { useState } from "react";
import { BusinessLink } from "@/components/BusinessLink";
import { useStore, saleTotal, saleDiscount, saleTax, saleGrandTotal } from "@/lib/store";
import { Modal } from "@/components/ui";
import ReceivePaymentModal from "@/components/ReceivePaymentModal";
import { CheckCircle2 } from "lucide-react";
import { fmtMoney, fmtQtyWithUnit, fmtRateWithUnit, fmtDate, fmtTime } from "@/lib/format";
import { productUsesCategories, resolveDefs } from "@/lib/catalogue";

const statusStyles: Record<string, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-success/10 text-success" },
  partially: { label: "Partially paid", cls: "bg-warning/10 text-warning" },
  unpaid: { label: "Unpaid", cls: "bg-destructive/10 text-destructive" },
};

export default function SaleDetailModal({
  saleId,
  onClose,
  justSaved = false,
  onNewSale,
}: {
  saleId: string | null;
  onClose: () => void;
  /** opened right after the sale was saved: show a confirmation */
  justSaved?: boolean;
  onNewSale?: () => void;
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
  const status = paid >= grand - 0.001 ? "paid" : paid > 0 ? "partially" : "unpaid";
  const st = statusStyles[status];
  const paymentEntries = payments
    .filter((p) => p.type === "customer")
    .flatMap((p) => {
      if (p.saleId === sale.id) {
        return [{
          id: p.id,
          date: p.date,
          amount: p.amount,
          method: p.method,
          note: p.note,
        }];
      }
      const alloc = p.allocations?.find((a) => a.saleId === sale.id);
      if (!alloc) return [];
      return [{
        id: `${p.id}:${sale.id}`,
        date: p.date,
        amount: alloc.amount,
        method: p.method,
        note: p.note,
      }];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const totalRows: { label: string; value: string }[] = [
    { label: "Subtotal", value: fmtMoney(total) },
    ...(disc > 0 ? [{ label: `Discount (${sale.discountPct ?? 0}%)`, value: `- ${fmtMoney(disc)}` }] : []),
    ...(tax > 0 ? [{ label: `Tax (${sale.taxPct ?? 0}%)`, value: `+ ${fmtMoney(tax)}` }] : []),
    ...((sale.loadingCharges ?? 0) > 0 ? [{ label: "Loading charges", value: `+ ${fmtMoney(sale.loadingCharges!)}` }] : []),
    ...((sale.transportCharges ?? 0) > 0 ? [{ label: "Transport charges", value: `+ ${fmtMoney(sale.transportCharges!)}` }] : []),
    ...((sale.labourCharges ?? 0) > 0 ? [{ label: "Labour cost", value: `+ ${fmtMoney(sale.labourCharges!)}` }] : []),
  ];
  const th = "text-xs font-medium uppercase tracking-wide text-[#171717]/60 px-4 py-3";

  return (
    <Modal
      open={!!sale}
      onClose={onClose}
      title={sale.invoiceNo}
      size="6xl"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <BusinessLink href={`/sales/${sale.id}`} className="btn-ghost">
            Print / Save PDF
          </BusinessLink>
          {due > 0 && (
            <button type="button" onClick={() => setPayOpen(true)} className="btn-ghost">
              Receive payment
            </button>
          )}
          {justSaved && onNewSale && (
            <button type="button" onClick={onNewSale} className="btn-ghost">
              New sale
            </button>
          )}
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      }
    >
      {justSaved && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-lg bg-success/10 px-4 py-3">
          <CheckCircle2 className="size-5 shrink-0 text-success mt-0.5" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-success">Sale saved</p>
            <p className="text-[13px] text-[#171717]/70">
              {sale.invoiceNo} for {cust?.name ?? "the customer"} is ready. Stock has been updated.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="min-w-0 space-y-6">
          {/* header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="text-xs font-medium uppercase tracking-wide text-[#171717]/60">Customer</span>
              <p className="font-semibold text-base text-[#171717] mt-1">{cust?.name ?? sale.customerId}</p>
              {(cust?.shop || cust?.phone) && (
                <p className="text-[13px] text-[#171717]/70 mt-0.5">
                  {[cust?.shop, cust?.phone].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md ${st.cls}`}>
                {st.label}
              </span>
              <p className="text-[13px] text-[#171717]/70 mt-2 tabular-nums">
                {fmtDate(sale.date)} · {fmtTime(sale.createdAt)}
              </p>
            </div>
          </div>

          {/* items table */}
          <div className="border border-[#E5E5E5] rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FAFAF9]">
                  <th className={`${th} text-left`}>Item</th>
                  <th className={`${th} text-right`}>Qty</th>
                  <th className={`${th} text-right`}>Rate</th>
                  <th className={`${th} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {sale.lines.map((l, i) => {
                  const prod = prodNameOf(l);
                  const cat = catNameOf(l);
                  const attrs = attrRowsOf(l);
                  const detail = [cat, ...attrs.map((a) => a.value)].filter(Boolean).join(" · ");
                  return (
                    <tr key={i} className="border-t border-[#E5E5E5] align-top">
                      <td className="px-4 py-3 max-w-[320px]">
                        <span className="block font-medium text-[#171717]">{prod || l.item}</span>
                        {detail && <span className="block text-[13px] text-[#171717]/70">{detail}</span>}
                        {!l.attributeSnapshot && l.qualityName ? (
                          <span className="inline-block mt-1 px-1.5 py-0.5 text-xs font-medium text-[#171717] bg-[#F8F8F7] rounded">
                            {l.qualityName}
                          </span>
                        ) : null}
                        {supplierName(l.supplierId) ? (
                          <span className="block text-[13px] text-[#171717]/70">Source: {supplierName(l.supplierId)}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{fmtQtyWithUnit(l.qty, l.unit)}</td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-[#171717]/70">{fmtRateWithUnit(l.rate, l.unit)}</td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-medium">{fmtMoney(l.qty * l.rate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* payment timeline */}
          {paymentEntries.length > 0 && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-[#171717]/60 mb-2">
                Payments on this invoice
              </h3>
              <div className="border border-[#E5E5E5] rounded-xl divide-y divide-[#E5E5E5] max-h-48 overflow-y-auto">
                {paymentEntries.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-[#171717]">
                        {fmtDate(p.date)} · <span className="capitalize">{p.method}</span>
                      </p>
                      {p.note ? <p className="text-[13px] text-[#171717]/70 truncate">{p.note}</p> : null}
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-success">{fmtMoney(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* totals */}
        <div className="border border-[#E5E5E5] rounded-xl bg-white p-4 sm:p-5 lg:sticky lg:top-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[#171717]/60 mb-3">Totals</p>
          <div className="space-y-2 text-sm">
            {totalRows.map((r) => (
              <div key={r.label} className="flex justify-between gap-3">
                <span className="text-[#171717]/70">{r.label}</span>
                <span className="tabular-nums text-[#171717]">{r.value}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center gap-3 rounded-lg bg-ink text-white px-4 py-3 mt-4">
            <span className="text-xs font-medium uppercase tracking-wide text-white/70">Total</span>
            <span className="text-lg font-semibold tabular-nums">{fmtMoney(grand)}</span>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-[#171717]/70">Paid</span>
              <span className="tabular-nums font-medium text-success">{fmtMoney(paid)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#171717]/70">Due</span>
              <span className={`tabular-nums font-semibold ${due > 0 ? "text-destructive" : "text-success"}`}>
                {due > 0 ? fmtMoney(due) : "Nothing due"}
              </span>
            </div>
          </div>
          {grand > 0 && (
            <div className="mt-3">
              <div
                className="h-2 w-full bg-[#F0F0EE] rounded-full overflow-hidden"
                role="progressbar"
                aria-label="Paid so far"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(paidPct)}
              >
                <div className={`h-full rounded-full ${due > 0 ? "bg-warning" : "bg-success"}`} style={{ width: `${paidPct}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-[#171717]/70 tabular-nums">{Math.round(paidPct)}% paid</p>
            </div>
          )}
        </div>
      </div>

      <ReceivePaymentModal saleId={payOpen ? sale.id : null} onClose={() => setPayOpen(false)} />
    </Modal>
  );
}
