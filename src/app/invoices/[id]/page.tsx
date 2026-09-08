"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useStore, saleTotal, saleDiscount, saleTax, saleGrandTotal } from "@/lib/store";
import { fmtMoney, fmtQtyWithUnit, fmtRateWithUnit, fmtDate, fmtTime } from "@/lib/format";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const { sales, customers, suppliers, byItem, lineUnitCost } = useStore();
  const sale = sales.find((s) => s.id === params.id);

  if (!sale)
    return <p className="p-8 text-neutral-500">Invoice not found.</p>;

  const supplierName = (id?: string) =>
    (id && suppliers.find((s) => s.id === id)?.name) || "";
  const cust = customers.find((c) => c.id === sale.customerId);
  const subtotal = saleTotal(sale);
  const disc = saleDiscount(sale);
  const tax = saleTax(sale);
  const grand = saleGrandTotal(sale);
  const cogs = sale.lines.reduce(
    (a, l, i) => a + l.qty * (lineUnitCost(sale.id, i) || byItem[l.item] || 0),
    0
  );

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-6 sm:mb-8 no-print">
        <Link href="/invoices" className="text-sm underline underline-offset-2 hover:text-neutral-500">
          ← All invoices
        </Link>
        <button className="btn-primary" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      <motion.div
        className="print-area border border-neutral-900 p-5 sm:p-10"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 border-b-2 border-black pb-6">
          <div>
            <div className="text-xl sm:text-2xl tracking-tight">STEEL<span className="text-neutral-400">/LEDGER</span></div>
            <div className="text-xs text-neutral-500 mt-1">Steel Trading Co. · Lahore, Pakistan</div>
            <div className="text-xs text-neutral-500">Ph: 042-111-222-333</div>
          </div>
          <div className="sm:text-right">
            <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Invoice</div>
            <div className="text-xl font-medium mt-1">{sale.invoiceNo}</div>
            <div className="text-xs text-neutral-500 mt-1">{fmtDate(sale.date)} · {fmtTime(sale.createdAt)}</div>
          </div>
        </div>

        <div className="py-6 border-b border-neutral-300">
          <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Bill to</div>
          <div className="font-medium">{cust?.name}</div>
          <div className="text-sm text-neutral-500">{cust?.shop} · {cust?.phone}</div>
        </div>

        <table className="my-6">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Rate</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((l, i) => (
              <tr key={i}>
                <td className="text-neutral-400">{i + 1}</td>
                <td>
                  {l.item}
                  {supplierName(l.supplierId) ? (
                    <span className="block text-[10px] text-neutral-400">
                      Source: {supplierName(l.supplierId)}
                    </span>
                  ) : null}
                </td>
                <td className="num">{fmtQtyWithUnit(l.qty, l.unit)}</td>
                <td className="num">{fmtRateWithUnit(l.rate, l.unit)}</td>
                <td className="num font-medium">{fmtMoney(l.qty * l.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-full sm:w-64">
            <div className="flex justify-between py-2 border-b border-neutral-300">
              <span className="text-neutral-500 text-sm">Subtotal</span>
              <span className="tabular-nums">{fmtMoney(subtotal)}</span>
            </div>
            {disc > 0 && (
              <div className="flex justify-between py-2 border-b border-neutral-300">
                <span className="text-neutral-500 text-sm">Discount ({(sale.discountPct ?? 0)}%)</span>
                <span className="tabular-nums text-neutral-500">− {fmtMoney(disc)}</span>
              </div>
            )}
            {tax > 0 ? (
              <div className="flex justify-between py-2 border-b border-neutral-300">
                <span className="text-neutral-500 text-sm">Tax ({(sale.taxPct ?? 0)}%)</span>
                <span className="tabular-nums">{fmtMoney(tax)}</span>
              </div>
            ) : (
              <div className="flex justify-between py-2 border-b border-neutral-300">
                <span className="text-neutral-500 text-sm">Tax</span>
                <span className="tabular-nums text-neutral-500">—</span>
              </div>
            )}
            <div className="flex justify-between py-3 bg-black text-white px-3 mt-2">
              <span className="text-xs uppercase tracking-widest">Total</span>
              <span className="tabular-nums font-medium">{fmtMoney(grand)}</span>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-neutral-300 text-xs text-neutral-500 flex flex-col sm:flex-row gap-2 sm:justify-between">
          <span>Thank you for your business. Goods once sold are not returnable.</span>
          <span className="no-print">Internal landed cost: {fmtMoney(cogs)}</span>
        </div>
      </motion.div>
    </div>
  );
}
