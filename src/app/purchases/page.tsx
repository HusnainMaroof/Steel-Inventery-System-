"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, purchaseTotal } from "@/lib/store";
import { STEEL_ITEMS } from "@/lib/mockData";
import { Page, PageTitle, Modal, useToggle } from "@/components/ui";
import { fmtMoney, fmtQty, fmtDate } from "@/lib/format";

export default function PurchasesPage() {
  const { purchases, suppliers, addPurchase } = useStore();
  const { open, onOpen, onClose } = useToggle();

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    supplierId: suppliers[0]?.id ?? "",
    item: STEEL_ITEMS[0],
    qty: 10,
    rate: 268000,
    transport: 30000,
    otherCost: 10000,
  });

  const landedPerTon = form.qty > 0
    ? (form.qty * form.rate + form.transport + form.otherCost) / form.qty
    : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    addPurchase({ ...form, qty: Number(form.qty), rate: Number(form.rate), transport: Number(form.transport), otherCost: Number(form.otherCost) });
    onClose();
  };

  const supplierName = (id: string) =>
    suppliers.find((s) => s.id === id)?.name ?? id;

  return (
    <Page>
      <PageTitle
        title="Purchases"
        sub="Steel bought from mills, including transport & other costs"
        action={
          <button className="btn-primary" onClick={onOpen}>
            + Add Purchase
          </button>
        }
      />

      <div className="border border-neutral-200 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Mill</th>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Mill rate/t</th>
              <th className="num">Transport</th>
              <th className="num">Other</th>
              <th className="num">Total</th>
              <th className="num">Landed /t</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {purchases.map((p) => (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0, backgroundColor: "#e5e5e5" }}
                  animate={{ opacity: 1, backgroundColor: "rgba(0,0,0,0)" }}
                  transition={{ duration: 0.6 }}
                  exit={{ opacity: 0 }}
                >
                  <td className="whitespace-nowrap">{fmtDate(p.date)}</td>
                  <td>{supplierName(p.supplierId)}</td>
                  <td>{p.item}</td>
                  <td className="num">{fmtQty(p.qty)}</td>
                  <td className="num">{fmtMoney(p.rate)}</td>
                  <td className="num">{fmtMoney(p.transport)}</td>
                  <td className="num">{fmtMoney(p.otherCost)}</td>
                  <td className="num font-medium">{fmtMoney(purchaseTotal(p))}</td>
                  <td className="num text-neutral-500">
                    {fmtMoney(purchaseTotal(p) / p.qty)}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={onClose} title="Add Purchase">
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div>
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div>
            <label>Mill / Supplier</label>
            <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label>Item</label>
            <select value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })}>
              {STEEL_ITEMS.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Quantity (tons)</label>
            <input type="number" min="0.1" step="0.1" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} required />
          </div>
          <div>
            <label>Mill rate / ton</label>
            <input type="number" min="0" value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} required />
          </div>
          <div>
            <label>Transport cost</label>
            <input type="number" min="0" value={form.transport} onChange={(e) => setForm({ ...form, transport: Number(e.target.value) })} />
          </div>
          <div>
            <label>Other costs</label>
            <input type="number" min="0" value={form.otherCost} onChange={(e) => setForm({ ...form, otherCost: Number(e.target.value) })} />
          </div>
          <div className="col-span-2 border border-dashed border-neutral-400 p-3 flex justify-between items-center">
            <span className="text-xs uppercase tracking-widest text-neutral-500">
              Landed cost / ton
            </span>
            <span className="font-medium tabular-nums">{fmtMoney(landedPerTon)}</span>
          </div>
          <div className="col-span-2 flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Save Purchase</button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
