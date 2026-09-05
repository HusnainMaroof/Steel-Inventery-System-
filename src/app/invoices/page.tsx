"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useStore, saleTotal } from "@/lib/store";
import { Page, PageTitle } from "@/components/ui";
import SaleDetailModal from "@/components/SaleDetailModal";
import { fmtMoney, fmtDate } from "@/lib/format";

export default function InvoicesPage() {
  const { sales, customers } = useStore();
  const [viewId, setViewId] = useState<string | null>(null);

  return (
    <Page>
      <PageTitle title="Invoices" sub="Printable / PDF-ready sales invoices" />
      <div className="border border-neutral-200 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Customer</th>
              <th className="num">Total Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...sales].reverse().map((s, i) => (
              <motion.tr
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <td className="font-medium">{s.invoiceNo}</td>
                <td className="whitespace-nowrap">{fmtDate(s.date)}</td>
                <td>{customers.find((c) => c.id === s.customerId)?.name}</td>
                <td className="num font-medium">{fmtMoney(saleTotal(s))}</td>
                <td className="num">
                  <button
                    onClick={() => setViewId(s.id)}
                    className="underline underline-offset-2 hover:text-neutral-500"
                  >
                    Open →
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <SaleDetailModal saleId={viewId} onClose={() => setViewId(null)} />
    </Page>
  );
}
