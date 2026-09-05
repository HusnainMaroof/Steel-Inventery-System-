"use client";

import { useState } from "react";
import { useStore, saleTotal } from "@/lib/store";
import { Page, PageTitle, Modal, useToggle } from "@/components/ui";
import { fmtMoney, fmtDate } from "@/lib/format";

export default function CustomersPage() {
  const { customers, sales, payments, customerBalance, addCustomer } = useStore();
  const [selected, setSelected] = useState<string | null>(null);
  const { open, onOpen, onClose } = useToggle();
  const [form, setForm] = useState({ name: "", shop: "", phone: "" });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    addCustomer({
      name: form.name.trim(),
      shop: form.shop.trim(),
      phone: form.phone.trim(),
    });
    setForm({ name: "", shop: "", phone: "" });
    onClose();
  };

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
        sub="Balances and payment history for every customer"
        action={
          <button className="btn-primary" onClick={onOpen}>
            + New Customer
          </button>
        }
      />
      <div className="border border-neutral-200 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Shop / Area</th>
              <th>Phone</th>
              <th className="num">Sales</th>
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

      <Modal open={!!cust} onClose={() => setSelected(null)} title={cust ? `${cust.name} · Ledger` : "Customer"} size="2xl">
        {cust && (
          <>
            <p className="text-xs text-neutral-500 mb-5">{cust.shop} · {cust.phone}</p>

            {/* summary */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="border border-neutral-200 p-3">
                <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Sales</span>
                <span className="block font-medium tabular-nums mt-1">{fmtMoney(custTotalSales)}</span>
              </div>
              <div className="border border-neutral-200 p-3">
                <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Received</span>
                <span className="block font-medium tabular-nums mt-1">{fmtMoney(custTotalReceived)}</span>
              </div>
              <div className="border border-neutral-800 bg-black text-white p-3">
                <span className="block text-[11px] uppercase tracking-widest text-neutral-400">Balance</span>
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
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {custSales.length === 0 && (
                    <tr><td colSpan={3} className="text-neutral-400">No invoices yet.</td></tr>
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
              Payments ({custPayments.length})
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
          </>
        )}
      </Modal>

      {/* new customer popup */}
      <Modal open={open} onClose={onClose} title="New Customer">
        <form onSubmit={save} className="grid gap-4">
          <div>
            <label>Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Ahmed Steel Mart"
              required
              autoFocus
            />
          </div>
          <div>
            <label>Shop / Area</label>
            <input
              value={form.shop}
              onChange={(e) => setForm({ ...form, shop: e.target.value })}
              placeholder="e.g. Bilal Gunj, Lahore"
            />
          </div>
          <div>
            <label>Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g. 0300 1234567"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!form.name.trim()}>
              Add Customer
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
