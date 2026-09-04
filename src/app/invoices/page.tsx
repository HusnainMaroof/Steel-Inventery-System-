"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useStore, saleTotal } from "@/lib/store";
import { Page, PageTitle } from "@/components/ui";
import { fmtMoney, fmtDate } from "@/lib/format";

export default function InvoicesPage() {
  const { sales, customers } = useStore();

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
              <th className="num">Amount</th>
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
                  <Link
                    href={`/invoices/${s.id}`}
                    className="underline underline-offset-2 hover:text-neutral-500"
                  >
                    Open →
                  </Link>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
