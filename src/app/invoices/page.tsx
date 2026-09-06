"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { useStore, saleGrandTotal, invoiceStatus } from "@/lib/store";
import { Page, PageTitle, EmptyState } from "@/components/ui";
import SaleDetailModal from "@/components/SaleDetailModal";
import ReceivePaymentModal from "@/components/ReceivePaymentModal";
import { fmtMoney, fmtDate } from "@/lib/format";

const statusStyles: Record<string, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-[#f0f7ef] text-[#2e6b2e] border-[#cfe3cd]" },
  partial: { label: "Partial", cls: "bg-[#fdf6e9] text-[#8a5a00] border-[#ecd9b0]" },
  unpaid: { label: "Unpaid", cls: "bg-[#fdf1ef] text-[#a12b1f] border-[#f0d2cc]" },
  advance: { label: "Advance", cls: "bg-[#eef3fb] text-[#1f4e8c] border-[#d2e0f2]" },
};

export default function InvoicesPage() {
  const { sales, customers, salePaid } = useStore();
  const [viewId, setViewId] = useState<string | null>(null);
  const [paySaleId, setPaySaleId] = useState<string | null>(null);

  const rows = [...sales].reverse().map((s) => {
    const total = saleGrandTotal(s);
    const paid = salePaid(s.id);
    const due = Math.max(0, total - paid);
    const status = invoiceStatus(paid, total);
    return { s, total, paid, due, status };
  });
  const unpaidCount = rows.filter((r) => r.due > 0).length;
  const totalDue = rows.reduce((a, r) => a + r.due, 0);

  return (
    <Page>
      <PageTitle title="Invoices" sub="All sales invoices — click Open to view, print or save as PDF" />

      {/* summary strip */}
      {sales.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="border border-neutral-200 bg-white p-4">
            <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Invoices</span>
            <span className="block text-xl font-semibold tabular-nums mt-1">{sales.length}</span>
          </div>
          <div className="border border-neutral-200 bg-white p-4">
            <span className="block text-[11px] uppercase tracking-widest text-neutral-500">With balance due</span>
            <span className="block text-xl font-semibold tabular-nums mt-1">{unpaidCount}</span>
          </div>
          <div className="border border-black bg-black text-white p-4">
            <span className="block text-[11px] uppercase tracking-widest text-neutral-400">Total outstanding</span>
            <span className="block text-xl font-semibold tabular-nums mt-1">{fmtMoney(totalDue)}</span>
          </div>
        </div>
      )}

      {sales.length === 0 ? (
        <EmptyState
          emoji="🧾"
          title="No invoices yet"
          hint="Create a sale and its invoice will appear here — ready to print or save as PDF."
          action={
            <Link href="/sales" className="btn-primary">
              + Create Sale
            </Link>
          }
        />
      ) : (
      <div className="border border-neutral-200 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Customer</th>
              <th className="num">Total</th>
              <th className="num">Paid</th>
              <th className="num">Due</th>
              <th>Status</th>
              <th className="num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, total, paid, due, status }, i) => {
              const st = statusStyles[status];
              return (
                <motion.tr
                  key={s.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <td className="font-medium">{s.invoiceNo}</td>
                  <td className="whitespace-nowrap">{fmtDate(s.date)}</td>
                  <td>{customers.find((c) => c.id === s.customerId)?.name}</td>
                  <td className="num">{fmtMoney(total)}</td>
                  <td className="num text-neutral-500">{fmtMoney(paid)}</td>
                  <td className={`num font-medium ${due > 0 ? "text-[#a12b1f]" : "text-neutral-400"}`}>
                    {fmtMoney(due)}
                  </td>
                  <td>
                    <span className={`inline-flex text-xs font-medium px-2 py-0.5 border rounded ${st.cls}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="num whitespace-nowrap">
                    {due > 0 && (
                      <button
                        onClick={() => setPaySaleId(s.id)}
                        className="btn-primary !py-1 !px-2.5 text-[11px] mr-2"
                      >
                        Receive
                      </button>
                    )}
                    <button
                      onClick={() => setViewId(s.id)}
                      className="underline underline-offset-2 hover:text-neutral-500 text-xs"
                    >
                      Open
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      <SaleDetailModal saleId={viewId} onClose={() => setViewId(null)} />
      <ReceivePaymentModal saleId={paySaleId} onClose={() => setPaySaleId(null)} />
    </Page>
  );
}
