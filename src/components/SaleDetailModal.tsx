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
  const paidAllTime = payments
    .filter((p) => p.type === "customer" && p.partyId === sale.customerId)
    .reduce((a, p) => a + p.amount, 0);
  const custBalance = customerBalance(sale.customerId); // negative = customer paid in advance
  const remaining = Math.max(0, custBalance);

  return (
    <Modal open={!!sale} onClose={onClose} title={sale.invoiceNo} size="2xl">
      {/* header — who, when */}
      <div className="flex flex-wrap justify-between gap-4 mb-5">
        <div>
          <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Customer</span>
          <span className="block font-medium mt-1">{cust?.name ?? sale.customerId}</span>
          <span className="block text-xs text-neutral-400">
            {cust?.shop}
            {cust?.phone ? ` · ${cust.phone}` : ""}
          </span>
        </div>
        <div className="text-right">
          <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Date</span>
          <span className="block font-medium mt-1">{fmtDate(sale.date)}</span>
        </div>
      </div>

      {/* items */}
      <div className="border border-neutral-200 mb-5">
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
                <td className="font-medium">{l.item}</td>
                <td className="num">{fmtQty(l.qty)}</td>
                <td className="num text-neutral-500">{fmtMoney(l.rate)}</td>
                <td className="num">{fmtMoney(l.qty * l.rate)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="num font-medium border-b-0">
                Total
              </td>
              <td className="num font-medium border-b-0">{fmtMoney(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* balance */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="border border-neutral-200 p-3">
          <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Paid (all time)</span>
          <span className="block font-medium tabular-nums mt-1">{fmtMoney(paidAllTime)}</span>
        </div>
        <div className={`p-3 text-white ${remaining > 0 ? "bg-black" : "bg-neutral-400"}`}>
          <span className="block text-[11px] uppercase tracking-widest text-neutral-400">
            {remaining > 0 ? "Balance Due" : "Fully Paid"}
          </span>
          <span className="block font-medium tabular-nums mt-1">
            {remaining > 0
              ? fmtMoney(remaining)
              : custBalance < 0
                ? `advance ${fmtMoney(Math.abs(custBalance))}`
                : "—"}
          </span>
        </div>
      </div>

      <div className="flex justify-end">
        <Link href={`/invoices/${sale.id}`} className="btn-primary !py-1.5 !px-4 text-xs">
          Print / Save PDF →
        </Link>
      </div>
    </Modal>
  );
}
