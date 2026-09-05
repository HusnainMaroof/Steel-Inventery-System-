"use client";

import { useState } from "react";
import { useStore, purchaseTotal } from "@/lib/store";
import { Page, PageTitle, Modal, useToggle } from "@/components/ui";
import { fmtMoney } from "@/lib/format";

export default function SuppliersPage() {
  const { suppliers, purchases, payments, supplierBalance, addSupplier } = useStore();
  const { open, onOpen, onClose } = useToggle();
  const [form, setForm] = useState({ name: "", mill: "", phone: "" });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    addSupplier({
      name: form.name.trim(),
      mill: form.mill.trim(),
      phone: form.phone.trim(),
    });
    setForm({ name: "", mill: "", phone: "" });
    onClose();
  };

  return (
    <Page>
      <PageTitle
        title="Mills / Suppliers"
        sub="Purchases, payments and what you still owe"
        action={
          <button className="btn-primary" onClick={onOpen}>
            + New Supplier
          </button>
        }
      />
      <div className="border border-neutral-200 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Supplier</th>
              <th>City</th>
              <th>Phone</th>
              <th className="num">Loads</th>
              <th className="num">Purchased</th>
              <th className="num">Paid</th>
              <th className="num">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => {
              const sp = purchases.filter((p) => p.supplierId === s.id);
              const purchased = sp.reduce((a, p) => a + purchaseTotal(p), 0);
              const paid = payments
                .filter((p) => p.type === "supplier" && p.partyId === s.id)
                .reduce((a, p) => a + p.amount, 0);
              const bal = supplierBalance(s.id);
              return (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td className="text-neutral-500">{s.mill}</td>
                  <td>{s.phone}</td>
                  <td className="num">{sp.length}</td>
                  <td className="num">{fmtMoney(purchased)}</td>
                  <td className="num text-neutral-500">{fmtMoney(paid)}</td>
                  <td className="num font-medium">
                    {bal > 0 ? fmtMoney(bal) : <span className="text-neutral-500">settled</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={onClose} title="New Supplier">
        <form onSubmit={save} className="grid gap-4">
          <div>
            <label>Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Malik Traders"
              required
              autoFocus
            />
          </div>
          <div>
            <label>City</label>
            <input
              value={form.mill}
              onChange={(e) => setForm({ ...form, mill: e.target.value })}
              placeholder="e.g. Lahore"
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
              Add Supplier
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
