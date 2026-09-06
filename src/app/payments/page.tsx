"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, saleGrandTotal } from "@/lib/store";
import { Page, PageTitle, Modal, useToggle, EmptyState } from "@/components/ui";
import { fmtMoney, fmtDate } from "@/lib/format";

export default function PaymentsPage() {
  const { payments, customers, suppliers, sales, salePaid, addPayment } = useStore();
  const { open, onOpen, onClose } = useToggle();
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "customer" as "customer" | "supplier",
    partyId: customers[0]?.id ?? "",
    saleId: "" as string,
    amount: 100000,
    method: "Cash" as "Cash" | "Bank" | "Cheque",
    note: "",
  });

  const parties = form.type === "customer" ? customers : suppliers;
  const partyName = (id: string) =>
    form.type === "customer"
      ? customers.find((c) => c.id === id)?.name ?? id
      : suppliers.find((s) => s.id === id)?.name ?? id;

  // unpaid invoices of the selected customer (to allocate a payment to a bill)
  const custInvoices = form.type === "customer"
    ? sales
        .filter((s) => s.customerId === form.partyId && saleGrandTotal(s) - salePaid(s.id) > 0)
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    addPayment({
      ...form,
      amount: Number(form.amount),
      saleId: form.saleId || undefined,
      note: form.note || undefined,
    });
    onClose();
  };

  return (
    <Page>
      <PageTitle
        title="Payments"
        sub="Money received from customers and paid to mills"
        action={
          <button className="btn-primary" onClick={onOpen}>
            + Record Payment
          </button>
        }
      />
      {payments.length === 0 ? (
        <EmptyState
          emoji="💸"
          title="No payments yet"
          hint="Record cash received from customers or paid to mills — every rupee gets remembered."
          action={
            <button className="btn-primary" onClick={onOpen}>
              + Record Payment
            </button>
          }
        />
      ) : (
      <div className="border border-neutral-200 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Party</th>
              <th>Invoice</th>
              <th>Method</th>
              <th>Note</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {payments.map((p) => (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0, backgroundColor: "#e5e5e5" }}
                  animate={{ opacity: 1, backgroundColor: "rgba(0,0,0,0)" }}
                  transition={{ duration: 0.6 }}
                  exit={{ opacity: 0 }}
                >
                  <td className="whitespace-nowrap">{fmtDate(p.date)}</td>
                  <td>
                    <span className="text-xs border border-neutral-300 px-2 py-0.5 uppercase tracking-wider">
                      {p.type}
                    </span>
                  </td>
                  <td className="font-medium">
                    {p.type === "customer"
                      ? customers.find((c) => c.id === p.partyId)?.name
                      : suppliers.find((s) => s.id === p.partyId)?.name}
                  </td>
                  <td className="text-xs text-neutral-500">
                    {p.type === "customer"
                      ? p.saleId
                        ? sales.find((s) => s.id === p.saleId)?.invoiceNo ?? "—"
                        : "—"
                      : "—"}
                  </td>
                  <td>{p.method}</td>
                  <td className="text-neutral-500 text-xs">{p.note ?? "—"}</td>
                  <td className="num font-medium">
                    {p.type === "customer" ? "+" : "−"} {fmtMoney(p.amount)}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      )}

      <Modal open={open} onClose={onClose} title="Record Payment">
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div>
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div>
            <label>Type</label>
            <select
              value={form.type}
              onChange={(e) => {
                const type = e.target.value as "customer" | "supplier";
                setForm({
                  ...form,
                  type,
                  partyId: (type === "customer" ? customers : suppliers)[0]?.id ?? "",
                  saleId: "",
                });
              }}
            >
              <option value="customer">Received from customer</option>
              <option value="supplier">Paid to mill</option>
            </select>
          </div>
          <div className="col-span-2">
            <label>{form.type === "customer" ? "Customer" : "Mill"}</label>
            <select
              value={form.partyId}
              onChange={(e) => setForm({ ...form, partyId: e.target.value, saleId: "" })}
            >
              {parties.map((p) => (
                <option key={p.id} value={p.id}>{partyName(p.id)}</option>
              ))}
            </select>
          </div>
          {form.type === "customer" && (
            <div className="col-span-2">
              <label>Apply to invoice (optional)</label>
              <select
                value={form.saleId}
                onChange={(e) => setForm({ ...form, saleId: e.target.value })}
              >
                <option value="">— Any unpaid invoice (oldest first) —</option>
                {custInvoices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.invoiceNo} · {fmtDate(s.date)} · due {fmtMoney(Math.max(0, saleGrandTotal(s) - salePaid(s.id)))}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label>Amount</label>
            <input type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />
          </div>
          <div>
            <label>Method</label>
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as typeof form.method })}>
              <option>Cash</option>
              <option>Bank</option>
              <option>Cheque</option>
            </select>
          </div>
          <div className="col-span-2">
            <label>Note (optional)</label>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="col-span-2 flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Save Payment</button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
