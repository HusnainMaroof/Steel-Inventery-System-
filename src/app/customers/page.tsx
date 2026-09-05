"use client";

import { useState } from "react";
import { useStore, saleTotal } from "@/lib/store";
import { Page, PageTitle, Modal } from "@/components/ui";
import { fmtMoney, fmtDate } from "@/lib/format";

export default function CustomersPage() {
  const { customers, sales, payments, customerBalance } = useStore();
  const [selected, setSelected] = useState<string | null>(null);

  const cust = customers.find((c) => c.id === selected);
  const custSales = cust ? sales.filter((s) => s.customerId === cust.id) : [];
  const custPayments = cust
    ? payments.filter((p) => p.type === "customer" && p.partyId === cust.id)
    : [];
  const custTotalSales = custSales.reduce((a, s) => a + saleTotal(s), 0);
  const custTotalReceived = custPayments.reduce((a, p) => a + p.amount, 0);

  // same wording as the dashboard: "owes ₨X" / "advance ₨X"
  const balanceText = (bal: number) =>
    bal > 0 ? (
      <span className="hl">owes {fmtMoney(bal)}</span>
    ) : (
      <span className="text-neutral-500">advance {fmtMoney(-bal)}</span>
    );

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
              <th className="num">Total Sales</th>
              <th className="num">Payments Received</th>
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
                  <td className="num text-neutral-500">{fmtMoney(received)}</td>
                  <td className="num font-medium">{balanceText(bal)}</td>
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

      <Modal open={!!cust} onClose={() => setSelected(null)} title={cust ? `Customer · ${cust.name}` : "Customer"}>
        {cust && (
          <>
            <p className="text-xs text-neutral-500 mb-5">{cust.shop} · {cust.phone}</p>

            {/* summary — same wording as the dashboard */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="border border-neutral-200 p-3">
                <span className="block text-xs uppercase tracking-widest text-neutral-500">Total Sales</span>
                <span className="block font-medium tabular-nums mt-1">{fmtMoney(custTotalSales)}</span>
              </div>
              <div className="border border-neutral-200 p-3">
                <span className="block text-xs uppercase tracking-widest text-neutral-500">Payments Received</span>
                <span className="block font-medium tabular-nums mt-1">{fmtMoney(custTotalReceived)}</span>
              </div>
              <div className="border border-neutral-800 bg-black text-white p-3">
                <span className="block text-xs uppercase tracking-widest text-neutral-400">Balance</span>
                <span className="block font-medium tabular-nums mt-1">
                  {(() => {
                    const b = customerBalance(cust.id);
                    return b > 0 ? `owes ${fmtMoney(b)}` : `advance ${fmtMoney(-b)}`;
                  })()}
                </span>
              </div>
            </div>

            {/* invoices */}
            <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">
              Invoices ({custSales.length})
            </h3>
            <div className="border border-neutral-200 mb-6 max-h-56 overflow-y-auto">
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th className="num">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {custSales.length === 0 && (
                    <tr><td colSpan={3} className="text-neutral-400">No sales yet.</td></tr>
                  )}
                  {custSales.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.invoiceNo}</td>
                      <td className="whitespace-nowrap">{fmtDate(s.date)}</td>
                      <td className="num">{fmtMoney(saleTotal(s))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* payments */}
            <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">
              Payments Received ({custPayments.length})
            </h3>
            <div className="border border-neutral-200 max-h-56 overflow-y-auto">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {custPayments.length === 0 && (
                    <tr><td colSpan={3} className="text-neutral-400">No payments yet.</td></tr>
                  )}
                  {custPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap">{fmtDate(p.date)}</td>
                      <td className="text-neutral-500">{p.method}</td>
                      <td className="num">− {fmtMoney(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-neutral-500 mt-4">
              Balance = Total Sales − Payments Received. A negative balance means the customer paid in advance.
            </p>
          </>
        )}
      </Modal>
    </Page>
  );
}
