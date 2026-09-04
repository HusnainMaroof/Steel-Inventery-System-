"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, saleTotal } from "@/lib/store";
import { STEEL_ITEMS } from "@/lib/mockData";
import { Page, PageTitle, Modal, useToggle } from "@/components/ui";
import { fmtMoney, fmtQty, fmtDate } from "@/lib/format";

export default function SalesPage() {
  const { sales, customers, inventory, addSale } = useStore();
  const { open, onOpen, onClose } = useToggle();
  const stockMap = Object.fromEntries(inventory.map((r) => [r.item, r.stockQty]));

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    customerId: customers[0]?.id ?? "",
    item: STEEL_ITEMS[0],
    qty: 5,
    rate: 290000,
  });

  const insufficient = form.qty > (stockMap[form.item] ?? 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    addSale({
      date: form.date,
      customerId: form.customerId,
      lines: [{ item: form.item, qty: Number(form.qty), rate: Number(form.rate) }],
    });
    onClose();
  };

  const customerName = (id: string) =>
    customers.find((c) => c.id === id)?.name ?? id;

  return (
    <Page>
      <PageTitle
        title="Sales"
        sub="Steel sold to customers — invoices are generated automatically"
        action={
          <button className="btn-primary" onClick={onOpen}>
            + New Sale
          </button>
        }
      />

      <div className="border border-neutral-200 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Items</th>
              <th className="num">Qty</th>
              <th className="num">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {sales.map((s) => (
                <motion.tr
                  key={s.id}
                  initial={{ opacity: 0, backgroundColor: "#e5e5e5" }}
                  animate={{ opacity: 1, backgroundColor: "rgba(0,0,0,0)" }}
                  transition={{ duration: 0.6 }}
                  exit={{ opacity: 0 }}
                >
                  <td className="font-medium">{s.invoiceNo}</td>
                  <td className="whitespace-nowrap">{fmtDate(s.date)}</td>
                  <td>{customerName(s.customerId)}</td>
                  <td className="text-neutral-500 text-xs">
                    {s.lines.map((l) => `${l.item} × ${l.qty}t @ ${fmtMoney(l.rate)}`).join(", ")}
                  </td>
                  <td className="num">{fmtQty(s.lines.reduce((a, l) => a + l.qty, 0))}</td>
                  <td className="num font-medium">{fmtMoney(saleTotal(s))}</td>
                  <td className="num">
                    <Link href={`/invoices/${s.id}`} className="underline underline-offset-2 hover:text-neutral-500">
                      View
                    </Link>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={onClose} title="New Sale">
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div>
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div>
            <label>Customer</label>
            <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label>Item</label>
            <select value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })}>
              {inventory.map((r) => (
                <option key={r.item} value={r.item} disabled={r.stockQty <= 0}>
                  {r.item} — {r.stockQty.toFixed(1)}t in stock
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Quantity (tons)</label>
            <input type="number" min="0.1" step="0.1" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} required />
          </div>
          <div>
            <label>Selling price / ton</label>
            <input type="number" min="0" value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} required />
          </div>
          {insufficient && (
            <div className="col-span-2 text-xs border border-black p-3">
              ⚠ Only {fmtQty(stockMap[form.item] ?? 0)} of {form.item} in stock.
            </div>
          )}
          <div className="col-span-2 flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={insufficient}>
              Save Sale
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
