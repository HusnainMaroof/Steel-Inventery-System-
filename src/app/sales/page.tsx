"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, saleTotal } from "@/lib/store";
import { Page, PageTitle, Modal, useToggle } from "@/components/ui";
import SaleDetailModal from "@/components/SaleDetailModal";
import { fmtMoney, fmtQty, fmtQtyWithUnit, fmtDate } from "@/lib/format";

interface LineForm {
  item: string;
  qty: number; // entered in the item's display unit (kg or ton)
  rate: number; // entered per display unit
}

const numVal = (n: number) => (n === 0 ? "" : String(n));

export default function SalesPage() {
  const { sales, customers, inventory, addSale, addPayment, addCustomer } = useStore();
  const { open, onOpen, onClose } = useToggle();
  const [viewId, setViewId] = useState<string | null>(null);

  // customer: pick existing, or open the add-customer popup
  const [existingId, setExistingId] = useState(customers[0]?.id ?? "");
  const { open: newCustOpen, onOpen: onNewCustOpen, onClose: onNewCustClose } = useToggle();
  const [newCust, setNewCust] = useState({ name: "", shop: "", phone: "" });

  // multiple product lines
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const defaultLine = (): LineForm => {
    const first = inventory[0];
    return { item: first?.item ?? "", qty: 1, rate: Math.round(first?.avgSellRate ?? 0) };
  };
  const [lines, setLines] = useState<LineForm[]>([defaultLine()]);
  const [paidNow, setPaidNow] = useState(0);

  const invMap = Object.fromEntries(inventory.map((r) => [r.item, r]));
  const unitOf = (item: string) => invMap[item]?.unit ?? "ton";
  const toTons = (qty: number, unit: string) => (unit === "kg" ? qty / 1000 : qty);
  const ratePerTon = (rate: number, unit: string) => (unit === "kg" ? rate * 1000 : rate);

  const lineStock = (l: LineForm) => invMap[l.item]?.stockQty ?? 0;
  const lineOver = (l: LineForm) => toTons(Number(l.qty) || 0, unitOf(l.item)) > lineStock(l);
  const totalAmount = lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0);
  const remaining = Math.max(0, totalAmount - (Number(paidNow) || 0));
  const canSave =
    lines.length > 0 &&
    lines.every((l) => l.item && (Number(l.qty) || 0) > 0 && (Number(l.rate) || 0) > 0) &&
    !lines.some(lineOver) &&
    !!existingId;

  const setLine = (i: number, patch: Partial<LineForm>) =>
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const changeItem = (i: number, item: string) => {
    const r = invMap[item];
    setLine(i, { item, rate: Math.round(r?.avgSellRate ?? 0) || 0, qty: 1 });
  };

  const saveNewCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCust.name.trim()) return;
    const id = addCustomer({
      name: newCust.name.trim(),
      shop: newCust.shop.trim(),
      phone: newCust.phone.trim(),
    });
    setExistingId(id);
    setNewCust({ name: "", shop: "", phone: "" });
    onNewCustClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    addSale({
      date: saleDate,
      customerId: existingId,
      lines: lines.map((l) => ({
        item: l.item,
        qty: toTons(Number(l.qty), unitOf(l.item)),
        rate: ratePerTon(Number(l.rate), unitOf(l.item)),
      })),
    });
    if ((Number(paidNow) || 0) > 0) {
      addPayment({
        date: saleDate,
        type: "customer",
        partyId: existingId,
        amount: Number(paidNow),
        method: "Cash",
        note: "Paid at time of sale",
      });
    }
    // reset for next entry
    setLines([defaultLine()]);
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
              <th className="num">Total</th>
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

      <Modal open={open} onClose={onClose} title="New Sale" size="3xl">
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* date + customer */}
          <div>
            <label>Date</label>
            <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} required />
          </div>
          <div className="sm:col-span-2">
            <div className="flex justify-between items-center mb-1">
              <label className="!mb-0">Customer</label>
              <button type="button" onClick={onNewCustOpen} className="text-xs underline underline-offset-2 hover:text-neutral-500">
                + New Customer
              </button>
            </div>
            <select value={existingId} onChange={(e) => setExistingId(e.target.value)} className="w-full">
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.shop} {c.phone ? `· ${c.phone}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* products sold */}
          <div className="sm:col-span-3">
            <div className="flex justify-between items-center mb-2">
              <label className="!mb-0">Products Sold</label>
              <button
                type="button"
                className="btn-ghost !py-1 !px-3 text-xs"
                onClick={() => setLines((prev) => [...prev, defaultLine()])}
              >
                + Add Product
              </button>
            </div>
            <div className="border border-neutral-200">
              {/* header row */}
              <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_2rem] gap-2 px-3 py-2 bg-neutral-50 border-b border-neutral-200 text-[10px] uppercase tracking-widest text-neutral-500">
                <span>Product Item</span>
                <span className="text-right">In Stock</span>
                <span className="text-right">Quantity</span>
                <span className="text-right">Rate (per unit)</span>
                <span className="text-right">Line Total</span>
                <span />
              </div>
              {lines.map((l, i) => {
                const unit = unitOf(l.item);
                const stock = lineStock(l);
                const over = lineOver(l);
                return (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_2rem] gap-2 p-3 border-b border-neutral-200 last:border-b-0 items-center">
                    <select value={l.item} onChange={(e) => changeItem(i, e.target.value)}>
                      {inventory.map((r) => (
                        <option key={r.item} value={r.item} disabled={r.stockQty <= 0}>
                          {r.item} — {fmtQtyWithUnit(r.stockQty, r.unit)} in stock
                        </option>
                      ))}
                    </select>
                    <span className={`text-xs tabular-nums md:text-right ${over ? "text-red-600 font-medium" : "text-neutral-500"}`}>
                      {over ? "Not enough stock!" : fmtQtyWithUnit(stock, unit)}
                    </span>
                    <div>
                      <input
                        type="number" min="0" step="any"
                        placeholder={`Qty (${unit})`}
                        value={numVal(l.qty)}
                        onChange={(e) => setLine(i, { qty: Number(e.target.value) })}
                        required
                        className={over ? "!border-red-600" : ""}
                      />
                      {over && (
                        <p className="text-[11px] text-red-600 mt-1">
                          Only {fmtQtyWithUnit(stock, unit)} available
                        </p>
                      )}
                    </div>
                    <input
                      type="number" min="0" step="any"
                      placeholder={`Rate (${unit === "kg" ? "₨ / kg" : "₨ / ton"})`}
                      value={numVal(l.rate)}
                      onChange={(e) => setLine(i, { rate: Number(e.target.value) })}
                      required
                    />
                    <span className="text-xs tabular-nums md:text-right font-medium">
                      {fmtMoney((Number(l.qty) || 0) * (Number(l.rate) || 0))}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                      disabled={lines.length <= 1}
                      className="text-neutral-400 hover:text-red-600 text-sm justify-self-end disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remove line"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          {/* payment */}
          <div>
            <label>Paid Now</label>
            <input type="number" min="0" placeholder="0" value={numVal(paidNow)} onChange={(e) => setPaidNow(Number(e.target.value))} />
          </div>

          {/* summaries */}
          <div className="sm:col-span-3 border border-dashed border-neutral-400 p-3 flex justify-between items-center">
            <span className="text-xs uppercase tracking-widest text-neutral-500">Total Amount</span>
            <span className="font-medium tabular-nums text-right shrink-0">
              {fmtMoney(totalAmount).replace("₨ ", "")}
              <span className="text-neutral-400 text-xs ml-1">₨</span>
            </span>
          </div>
          <div className="sm:col-span-3 border border-dashed border-neutral-800 p-3 flex justify-between items-center bg-black text-white">
            <span className="text-xs uppercase tracking-widest text-neutral-400">Remaining Due</span>
            <span className="font-medium tabular-nums text-right shrink-0">
              {fmtMoney(remaining).replace("₨ ", "")}
              <span className="text-neutral-500 text-xs ml-1">₨</span>
            </span>
          </div>

          <div className="sm:col-span-3 flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!canSave}>
              Save Sale
            </button>
          </div>
        </form>
      </Modal>

      {/* add customer popup */}
      <Modal open={newCustOpen} onClose={onNewCustClose} title="New Customer">
        <form onSubmit={saveNewCustomer} className="grid gap-4">
          <div>
            <label>Name *</label>
            <input value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} required autoFocus />
          </div>
          <div>
            <label>Shop / Area</label>
            <input value={newCust.shop} onChange={(e) => setNewCust({ ...newCust, shop: e.target.value })} />
          </div>
          <div>
            <label>Phone</label>
            <input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onNewCustClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!newCust.name.trim()}>
              Add Customer
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}


