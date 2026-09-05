"use client";

import { useState } from "react";
import { useStore, saleTotal } from "@/lib/store";
import { Page, PageTitle } from "@/components/ui";
import { fmtMoney, fmtDate } from "@/lib/format";

export default function CustomersPage() {
  const { customers, sales, payments, customerBalance } = useStore();
  const [selected, setSelected] = useState<string | null>(null);

  const cust = customers.find((c) => c.id === selected);
  const custSales = cust ? sales.filter((s) => s.customerId === cust.id) : [];
  const custPayments = cust
    ? payments.filter((p) => p.type === "customer" && p.partyId === cust.id)
    : [];

  return (
    <Page>
      <PageTitle
        title="Customers"
        sub="Who owes you — and who paid in advance"
      />
      <div className="border border-neutral-200 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Shop / Area</th>
              <th>Phone</th>
              <th className="num">Invoiced</th>
              <th className="num">Received</th>
              <th className="num">Balance</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const invoiced = sales
                .filter((s) => s.customerId === c.id)
                .reduce((a, s) => a + saleTotal(s), 0);
              const received = payments
                .filter((p) => p.type === "customer" && p.partyId === c.id)
                .reduce((a, p) => a + p.amount, 0);
              const bal = customerBalance(c.id);
              return (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td className="text-neutral-500">{c.shop}</td>
                  <td>{c.phone}</td>
                  <td className="num">{fmtMoney(invoiced)}</td>
                  <td className="num">{fmtMoney(received)}</td>
                  <td className="num font-medium">
                    {bal > 0 ? (
                      <span className="hl">{fmtMoney(bal) + " due"}</span>
                    ) : (
                      <span className="text-neutral-500">
                        {fmtMoney(-bal)} advance
                      </span>
                    )}
                  </td>
                  <td className="num">
                    <button
                      onClick={() => setSelected(c.id)}
                      className="underline underline-offset-2 hover:text-neutral-500"
                    >
                      Ledger
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative bg-white border border-neutral-900 w-full max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg">{cust.name}</h2>
                <p className="text-xs text-neutral-500">{cust.shop} · {cust.phone}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-neutral-400 hover:text-black">✕</button>
            </div>
            <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Invoices</h3>
            <table className="mb-6">
              <tbody>
                {custSales.map((s) => (
                  <tr key={s.id}>
                    <td>{s.invoiceNo}</td>
                    <td>{fmtDate(s.date)}</td>
                    <td className="num">{fmtMoney(saleTotal(s))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Payments</h3>
            <table>
              <tbody>
                {custPayments.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.date)}</td>
                    <td>{p.method}</td>
                    <td className="num">− {fmtMoney(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 pt-4 border-t border-neutral-900 flex justify-between font-medium">
              <span>Balance</span>
              <span className="tabular-nums">
                {(() => {
                  const b = customerBalance(cust.id);
                  return b >= 0 ? <span className="hl">{fmtMoney(b) + " due"}</span> : fmtMoney(-b) + " advance";
                })()}
              </span>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
