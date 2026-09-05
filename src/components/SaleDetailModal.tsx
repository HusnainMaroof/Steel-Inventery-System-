"use client";

import Link from "next/link";
import { useStore, saleTotal } from "@/lib/store";
import { Modal } from "@/components/ui";
import { fmtMoney, fmtQty, fmtDate } from "@/lib/format";

// shared sale/invoice detail popup — used by the Sales and Invoices tabs
export default function SaleDetailModal({
  saleId,
  onClose,
}: {
  saleId: string | null;
  onClose: () => void;
}) {
  const { sales, customers, payments, customerBalance } = useStore();
  const sale = sales.find((s) => s.id === saleId) ?? null;
  if (!sale) return null;
  const cust = customers.find((c) => c.id === sale.customerId);
  const total = saleTotal(sale);
  const totalQty = sale.lines.reduce((a, l) => a + l.qty, 0);
  const paidAllTime = payments
    .filter((p) => p.type === "customer" && p.partyId === sale.customerId)
    .reduce((a, p) => a + p.amount, 0);
  const custBalance = customerBalance(sale.customerId); // negative = customer paid in advance
  const remaining = Math.max(0, custBalance);

  return (
    <Modal open={!!sale} onClose={onClose} title={`Sale · ${sale.invoiceNo}`}>
      {/* header info */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <span className="block text-xs uppercase tracking-widest text-neutral-500">Customer</span>
          <span className="block font-medium mt-1">{cust?.name ?? sale.customerId}</span>
          <span className="block text-xs text-neutral-400">{cust?.shop} · {cust?.phone}</span>
        </div>
        <div className="text-right">
          <span className="block text-xs uppercase tracking-widest text-neutral-500">Date</span>
          <span className="block font-medium mt-1">{fmtDate(sale.date)}</span>
        </div>
      </div>

      {/* lines */}
      <div className="border border-neutral-200 mb-5">
        <table>
          <thead>
            <tr>
              <th>Product Item</th>
              <th className="num">Quantity</th>
              <th className="num">Your Selling Price</th>
              <th className="num">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((l, i) => (
              <tr key={i}>
                <td className="font-medium">{l.item}</td>
                <td className="num">{fmtQty(l.qty)}</td>
                <td className="num text-neutral-500">{fmtMoney(l.rate)} / ton</td>
                <td className="num">{fmtMoney(l.qty * l.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* totals + payment summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="border border-neutral-200 p-3">
          <span className="block text-xs uppercase tracking-widest text-neutral-500">Total Amount</span>
          <span className="block font-medium tabular-nums mt-1">{fmtMoney(total)}</span>
          <span className="block text-xs text-neutral-400 mt-1">{fmtQty(totalQty)} total</span>
        </div>
        <div className="border border-neutral-200 p-3">
          <span className="block text-xs uppercase tracking-widest text-neutral-500">Payments Received</span>
          <span className="block font-medium tabular-nums mt-1">{fmtMoney(paidAllTime)}</span>
          <span className="block text-xs text-neutral-400 mt-1">from this customer, all time</span>
        </div>
        <div className={`p-3 text-white ${remaining > 0 ? "bg-black" : "bg-neutral-400"}`}>
          <span className="block text-xs uppercase tracking-widest text-neutral-400">
            {remaining > 0 ? "Remaining Due" : "Fully Paid"}
          </span>
          <span className="block font-medium tabular-nums mt-1">{fmtMoney(remaining)}</span>
          <span className="block text-xs text-neutral-500 mt-1">
            {remaining > 0
              ? `${cust?.name ?? "customer"} owes this much in total`
              : custBalance < 0
                ? `${fmtMoney(Math.abs(custBalance))} paid in advance`
                : "nothing outstanding"}
          </span>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-xs text-neutral-500">
          Total Amount = what this invoice charges. Remaining Due = customer balance (Total Sales − Payments Received).
        </p>
        <Link href={`/invoices/${sale.id}`} className="btn-ghost !py-1.5 !px-3 text-xs shrink-0 ml-4">
          Print / Save PDF →
        </Link>
      </div>
    </Modal>
  );
}