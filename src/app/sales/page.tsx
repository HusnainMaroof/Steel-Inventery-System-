"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, saleTotal } from "@/lib/store";
import { Page, PageTitle, Modal, useToggle } from "@/components/ui";
import SaleDetailModal from "@/components/SaleDetailModal";
import { fmtMoney, fmtQty, fmtDate } from "@/lib/format";

interface LineForm {
  item: string;
  qty: number;
  rate: number;
}

const numVal = (n: number) => (n === 0 ? "" : String(n));

export default function SalesPage() {
  const { sales, customers, inventory, addSale, addPayment, addCustomer } = useStore();
  const { open, onOpen, onClose } = useToggle();
  const [viewId, setViewId] = useState<string | null>(null);

  // customer: pick existing or create new
  const [custMode, setCustMode] = useState<"existing" | "new">("existing");
  const [existingId, setExistingId] = useState(customers[0]?.id ?? "");
  const [newCust, setNewCust] = useState({ name: "", shop: "", phone: "" });

  // multiple product lines
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<LineForm[]>([
    { item: inventory[0]?.item ?? "", qty: 1, rate: 290000 },
  ]);
  const [paidNow, setPaidNow] = useState(0);

  const stockMap = Object.fromEntries(inventory.map((r) => [r.item, r.stockQty]));
  const totalAmount = lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0);
  const totalQty = lines.reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const remaining = Math.max(0, totalAmount - (Number(paidNow) || 0));
  const canSave =
    lines.length > 0 &&
    lines.every((l) => l.item && (Number(l.qty) || 0) > 0 && (Number(l.rate) || 0) > 0) &&
    !lines.some((l) => (Number(l.qty) || 0) > (stockMap[l.item] ?? 0)) &&
    (custMode === "existing" ? !!existingId : !!newCust.name.trim());

  const setLine = (i: number, patch: Partial<LineForm>) =>
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    let customerId = existingId;
    if (custMode === "new") {
      customerId = addCustomer({
        name: newCust.name.trim(),
        shop: newCust.shop.trim(),
        phone: newCust.phone.trim(),
      });
    }
    addSale({
      date: saleDate,
      customerId,
      lines: lines.map((l) => ({ item: l.item, qty: Number(l.qty), rate: Number(l.rate) })),
    });
    if ((Number(paidNow) || 0) > 0) {
      addPayment({
        date: saleDate,
        type: "customer",
        partyId: customerId,
        amount: Number(paidNow),
        method: "Cash",
        note: "Paid at time of sale",
      });
    }
    // reset for next entry
    setLines([{ item: inventory[0]?.item ?? "", qty: 1, rate: 290000 }]);
    setPaidNow(0);
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
              <th className="num">Total Amount</th>
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
                  <td className="text-neutral-500 text-xs whitespace-normal min-w-48">
                    {s.lines.map((l) => `${l.item} × ${l.qty}t @ ${fmtMoney(l.rate)}`).join(", ")}
                  </td>
                  <td className="num">{fmtQty(s.lines.reduce((a, l) => a + l.qty, 0))}</td>
                  <td className="num font-medium">{fmtMoney(saleTotal(s))}</td>
                  <td className="num">
                    <button
                      onClick={() => setViewId(s.id)}
                      className="underline underline-offset-2 hover:text-neutral-500"
                    >
                      View
                    </button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <SaleDetailModal saleId={viewId} onClose={() => setViewId(null)} />

      <Modal open={open} onClose={onClose} title="New Sale">
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div>
            <label>Date</label>
            <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} required />
          </div>

          {/* customer: existing or new */}
          <div>
            <label>Customer</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setCustMode("existing")}
                className={custMode === "existing" ? "btn-primary !py-1.5 !px-3 text-xs" : "btn-ghost !py-1.5 !px-3 text-xs"}
              >
                Existing
              </button>
              <button
                type="button"
                onClick={() => setCustMode("new")}
                className={custMode === "new" ? "btn-primary !py-1.5 !px-3 text-xs" : "btn-ghost !py-1.5 !px-3 text-xs"}
              >
                + New Customer
              </button>
            </div>
            {custMode === "existing" ? (
              <select value={existingId} onChange={(e) => setExistingId(e.target.value)}>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.shop}</option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <input placeholder="Name *" value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} required />
                <input placeholder="Shop" value={newCust.shop} onChange={(e) => setNewCust({ ...newCust, shop: e.target.value })} />
                <input placeholder="Phone" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
              </div>
            )}
          </div>

          {/* multiple product lines */}
          <div className="col-span-2">
            <div className="flex justify-between items-center mb-2">
              <label className="!mb-0">Products Sold</label>
              <button
                type="button"
                className="btn-ghost !py-1 !px-3 text-xs"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    { item: inventory[0]?.item ?? "", qty: 1, rate: 290000 },
                  ])
                }
              >
                + Add Product
              </button>
            </div>
            <div className="border border-neutral-200">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 p-3 border-b border-neutral-200 last:border-b-0">
                  <div className="grid grid-cols-3 gap-2">
                    <select value={l.item} onChange={(e) => setLine(i, { item: e.target.value })}>
                      {inventory.map((r) => (
                        <option key={r.item} value={r.item} disabled={r.stockQty <= 0}>
                          {r.item} — {r.stockQty.toFixed(1)}t in stock
                        </option>
                      ))}
                    </select>
                    <input
                      type="number" min="0.1" step="any" placeholder="Qty (tons)"
                      value={numVal(l.qty)}
                      onChange={(e) => setLine(i, { qty: Number(e.target.value) })}
                      required
                    />
                    <input
                      type="number" min="0" placeholder="Your Selling Price (per ton)"
                      value={numVal(l.rate)}
                      onChange={(e) => setLine(i, { rate: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-400 tabular-nums whitespace-nowrap">
                      {fmtMoney((Number(l.qty) || 0) * (Number(l.rate) || 0))}
                    </span>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                        className="text-neutral-400 hover:text-red-600 text-sm"
                        title="Remove line"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* payment */}
          <div>
            <label>Paid Now (to us)</label>
            <input type="number" min="0" placeholder="0" value={numVal(paidNow)} onChange={(e) => setPaidNow(Number(e.target.value))} />
          </div>
          <div className="flex items-end">
            <p className="text-xs text-neutral-500">
              Leave 0 to record the full amount as due. Payment is saved to the Payments tab automatically.
            </p>
          </div>

          {/* summaries */}
          <div className="col-span-2 border border-dashed border-neutral-400 p-3 flex justify-between items-center">
            <div>
              <span className="block text-xs uppercase tracking-widest text-neutral-500">Total Amount</span>
              <span className="block text-xs text-neutral-400 mt-1">
                {lines.length} product{lines.length > 1 ? "s" : ""} · {fmtQty(totalQty)}
              </span>
            </div>
            <span className="font-medium tabular-nums text-right shrink-0">
              {fmtMoney(totalAmount).replace("₨ ", "")}
              <span className="text-neutral-400 text-xs ml-1">₨</span>
            </span>
          </div>
          <div className="col-span-2 border border-dashed border-neutral-800 p-3 flex justify-between items-center bg-black text-white">
            <div>
              <span className="block text-xs uppercase tracking-widest text-neutral-400">
                Remaining Due from Customer
              </span>
              <span className="block text-xs text-neutral-500 mt-1">
                total {fmtMoney(totalAmount)} − paid {fmtMoney(Number(paidNow) || 0)}
              </span>
            </div>
            <span className="font-medium tabular-nums text-right shrink-0">
              {fmtMoney(remaining).replace("₨ ", "")}
              <span className="text-neutral-500 text-xs ml-1">₨</span>
            </span>
          </div>

          <div className="col-span-2 flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!canSave}>
              Save Sale
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
