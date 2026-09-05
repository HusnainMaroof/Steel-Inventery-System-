"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, purchaseTotal } from "@/lib/store";
import { STEEL_ITEMS } from "@/lib/mockData";
import { Page, PageTitle, Modal, useToggle } from "@/components/ui";
import { fmtMoney, fmtQty, fmtDate, fmtDateTime } from "@/lib/format";
import type { Purchase } from "@/lib/types";

export default function PurchasesPage() {
  const { purchases, suppliers, inventory, addPurchase, updatePurchase, deletePurchase } = useStore();
  const { open, onOpen, onClose } = useToggle();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "dues">("all");
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    supplierId: suppliers[0]?.id ?? "",
    item: STEEL_ITEMS[0],
    qty: 0,
    rate: 0,
    transport: 0,
    otherCost: 0,
    sellRate: 0,
    paidNow: 0,
  });

  const landedPerTon = form.qty > 0
    ? (form.qty * form.rate + form.transport + form.otherCost) / form.qty
    : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const { paidNow, ...rest } = form;
    addPurchase({
      ...rest,
      qty: Number(rest.qty),
      rate: Number(rest.rate),
      transport: Number(rest.transport),
      otherCost: Number(rest.otherCost),
      paid: Number(paidNow) || 0,
      lastPaidAt: rest.date,
      lastPaidAmount: Number(paidNow) || 0,
      paymentHistory:
        Number(paidNow) > 0
          ? [{ date: new Date().toISOString(), amount: Number(paidNow) }]
          : [],
    });
    onClose();
  };

  const supplierName = (id: string) =>
    suppliers.find((s) => s.id === id)?.name ?? id;

  // show 0 values as an empty field instead of a literal "0"
  const numVal = (v: number) => (v === 0 ? "" : v);

  const remainingOf = (p: Purchase) =>
    Math.max(0, purchaseTotal(p) - (p.paid ?? 0));

  const duePurchases = purchases.filter((p) => remainingOf(p) > 0);
  const totalDue = duePurchases.reduce((a, p) => a + remainingOf(p), 0);

  const removePurchase = (p: Purchase) => {
    if (
      window.confirm(
        `Delete this purchase?\n\n${p.item} · ${fmtQty(p.qty)} tons · ${fmtDate(p.date)}\n\nAll its details and payment records will be permanently removed.`
      )
    ) {
      deletePurchase(p.id);
      if (selectedId === p.id) setSelectedId(null);
      if (payId === p.id) setPayId(null);
    }
  };

  const selected = purchases.find((p) => p.id === selectedId) ?? null;
  let detailRows: { label: string; value: string; strong?: boolean }[] = [];
  if (selected) {
    const total = purchaseTotal(selected);
    const costPerTon = selected.qty > 0 ? total / selected.qty : 0;
    const avgSellPerTon =
      inventory.find((r) => r.item === selected.item)?.avgSellRate ?? 0;
    // profit is based on YOUR selling price; average market rate is only a fallback
    const usedSell = selected.sellRate ?? avgSellPerTon;
    const profitPerTon = usedSell - costPerTon;
    detailRows = [
      { label: "Purchase Date", value: fmtDate(selected.date) },
      { label: "Supplier", value: supplierName(selected.supplierId) },
      { label: "Steel Type", value: selected.item },
      { label: "Quantity", value: `${fmtQty(selected.qty)} tons` },
      { label: "Buying Price / Ton", value: fmtMoney(selected.rate) },
      { label: "Transport Cost", value: fmtMoney(selected.transport) },
      { label: "Other Expenses", value: fmtMoney(selected.otherCost) },
      { label: "Paid to Supplier", value: fmtMoney(selected.paid ?? 0) },
      {
        label: "Remaining Due",
        value: fmtMoney(Math.max(0, total - (selected.paid ?? 0))),
        strong: Math.max(0, total - (selected.paid ?? 0)) > 0,
      },
      { label: "Actual Cost / Ton", value: fmtMoney(costPerTon) },
      { label: "Your Selling Price / Ton", value: fmtMoney(selected.sellRate ?? avgSellPerTon) },
      { label: "Profit / Ton", value: fmtMoney(profitPerTon), strong: true },
      ...(selected.sellRate
        ? [{ label: "Average Market Selling Price / Ton", value: fmtMoney(avgSellPerTon) }]
        : []),
    ];
  }

  return (
    <Page>
      <PageTitle
        title="Steel Purchases"
        sub="Steel bought from suppliers, including delivery and other costs"
        action={
          <button className="btn-primary" onClick={onOpen}>
            + Add Purchase
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-6 border-b border-neutral-200 mb-4">
        {([
          ["all", "All Purchases"],
          ["dues", `Payment Dues${totalDue > 0 ? ` (${duePurchases.length})` : ""}`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`pb-2 text-xs uppercase tracking-widest border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-black text-black font-medium"
                : "border-transparent text-neutral-400 hover:text-neutral-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "all" && (
      <div className="border border-neutral-200 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Purchase Date</th>
              <th>Supplier</th>
              <th>Steel Type</th>
              <th className="num">Quantity</th>
              <th className="num">Buying Price / Ton</th>
              <th className="num">Your Selling Price / Ton</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {purchases.map((p) => {
                const rem = remainingOf(p);
                return (
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
                  <td className={`num ${p.sellRate ? "" : "text-neutral-400"}`}>
                    {p.sellRate ? fmtMoney(p.sellRate) : "—"}
                  </td>
                  <td className="num whitespace-nowrap">
                    <button
                      onClick={() => setSelectedId(p.id)}
                      className="btn-ghost !py-1 !px-3 text-xs"
                    >
                      View
                    </button>
                    <button
                      onClick={() => removePurchase(p)}
                      className="btn-ghost !py-1 !px-3 text-xs text-red-600 hover:!bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      )}

      {tab === "dues" && (
        <div>
          <div className="border border-neutral-200 p-4 mb-4 flex justify-between items-center">
            <span className="text-xs uppercase tracking-widest text-neutral-500">
              Total Outstanding to Suppliers
            </span>
            <span className="font-medium tabular-nums text-lg">{fmtMoney(totalDue)}</span>
          </div>

          {duePurchases.length === 0 ? (
            <div className="border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
              No pending dues — all purchases are fully paid.
            </div>
          ) : (
            <div className="border border-neutral-200 overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Purchase Date</th>
                    <th>Supplier</th>
                    <th>Steel Type</th>
                    <th className="num">Total Cost</th>
                    <th className="num">Paid</th>
                    <th className="num">Remaining</th>
                    <th className="num">Last Payment</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {duePurchases.map((p) => {
                    const total = purchaseTotal(p);
                    const paid = p.paid ?? 0;
                    const rem = remainingOf(p);
                    return (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap">{fmtDate(p.date)}</td>
                        <td>{supplierName(p.supplierId)}</td>
                        <td>{p.item}</td>
                        <td className="num">{fmtMoney(total)}</td>
                        <td className="num text-neutral-500">{fmtMoney(paid)}</td>
                        <td className="num font-medium">{fmtMoney(rem)}</td>
                        <td className={`num whitespace-nowrap ${p.lastPaidAt ? "" : "text-neutral-400"}`}>
                          {p.lastPaidAt ? fmtDate(p.lastPaidAt) : "—"}
                        </td>
                        <td className="num whitespace-nowrap">
                          <button
                            onClick={() => {
                              setPayId(p.id);
                              setPayAmount(0);
                            }}
                            className="btn-primary !py-1 !px-3 text-xs"
                          >
                            Pay
                          </button>
                          <button
                            onClick={() => removePurchase(p)}
                            className="btn-ghost !py-1 !px-3 text-xs text-red-600 hover:!bg-red-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal open={open} onClose={onClose} title="Add Purchase">
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div>
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div>
            <label>Supplier</label>
            <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label>Steel Type</label>
            <select value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })}>
              {STEEL_ITEMS.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Quantity (tons)</label>
            <input type="number" min="0.1" step="0.1" placeholder="0" value={numVal(form.qty)} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} required />
          </div>
          <div>
            <label>Buying Price / Ton</label>
            <input type="number" min="0" placeholder="0" value={numVal(form.rate)} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} required />
          </div>
          <div>
            <label>Transport Cost</label>
            <input type="number" min="0" placeholder="0" value={numVal(form.transport)} onChange={(e) => setForm({ ...form, transport: Number(e.target.value) })} />
          </div>
          <div>
            <label>Other Expenses</label>
            <input type="number" min="0" placeholder="0" value={numVal(form.otherCost)} onChange={(e) => setForm({ ...form, otherCost: Number(e.target.value) })} />
          </div>
          <div className="col-span-2">
            <label>Your Selling Price / Ton</label>
            <input type="number" min="0" placeholder="0" value={numVal(form.sellRate)} onChange={(e) => setForm({ ...form, sellRate: Number(e.target.value) })} />
          </div>
          <div className="col-span-2">
            <label>Paid Now (advance to supplier)</label>
            <input type="number" min="0" placeholder="0" value={numVal(form.paidNow)} onChange={(e) => setForm({ ...form, paidNow: Number(e.target.value) })} />
            <p className="text-xs text-neutral-500 mt-1">
              Leave 0 if you haven't paid anything yet — the rest shows up under Payment Dues.
            </p>
          </div>
          <div className="col-span-2 border border-dashed border-neutral-400 p-3 flex justify-between items-center">
            <span className="text-xs uppercase tracking-widest text-neutral-500">
              Total Factory Amount
            </span>
            <span className="font-medium tabular-nums">
              {fmtMoney(form.qty * form.rate)}
              <span className="text-neutral-400 text-xs ml-2">
                {fmtQty(form.qty)} × {fmtMoney(form.rate)}
              </span>
            </span>
          </div>
          <div className="col-span-2 border border-dashed border-neutral-400 p-3 flex justify-between items-center">
            <span className="text-xs uppercase tracking-widest text-neutral-500">
              Total Purchase Cost
            </span>
            <span className="font-medium tabular-nums">
              {fmtMoney(form.qty * form.rate + Number(form.transport) + Number(form.otherCost))}
            </span>
          </div>
          <div className="col-span-2 border border-dashed border-neutral-400 p-3 flex justify-between items-center">
            <span className="text-xs uppercase tracking-widest text-neutral-500">
              Actual Cost / Ton
            </span>
            <span className="font-medium tabular-nums">{fmtMoney(landedPerTon)}</span>
          </div>
          <div className="col-span-2 flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Save Purchase</button>
          </div>
        </form>
      </Modal>

      {/* Purchase details popup */}
      <Modal
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected ? `Purchase · ${selected.item}` : "Purchase Details"}
      >
        <div>
          {detailRows.map((r) => (
            <div
              key={r.label}
              className={`flex justify-between items-center gap-4 px-4 py-3 border-b border-neutral-200 last:border-b-0 ${
                r.strong ? "bg-black text-white" : ""
              }`}
            >
              <span
                className={`text-xs uppercase tracking-widest ${
                  r.strong ? "" : "text-neutral-500"
                }`}
              >
                {r.label}
              </span>
              <span className="tabular-nums text-right shrink-0 font-medium">
                {r.value}
              </span>
            </div>
          ))}
        </div>
        {selected && (
          <div className="flex justify-between items-center mt-4">
            <p className="text-xs text-neutral-500">
              Profit / Ton = Your Selling Price − Actual Cost / Ton (buying price + transport & other expenses, per ton).
            </p>
            <button
              onClick={() => removePurchase(selected)}
              className="btn-ghost !py-1 !px-3 text-xs text-red-600 hover:!bg-red-50 shrink-0"
            >
              Delete
            </button>
          </div>
        )}
      </Modal>

      {/* Pay due popup */}
      <Modal
        open={!!payId}
        onClose={() => setPayId(null)}
        title="Pay Supplier"
      >
        {(() => {
          const p = purchases.find((x) => x.id === payId);
          if (!p) return null;
          const total = purchaseTotal(p);
          const paid = p.paid ?? 0;
          const rem = Math.max(0, total - paid);
          const history =
            p.paymentHistory ??
            (paid > 0 ? [{ date: p.date + "T00:00:00", amount: paid }] : []);
          return (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const amt = Math.min(Number(payAmount) || 0, rem);
                updatePurchase(p.id, {
                  paid: paid + amt,
                  lastPaidAt: new Date().toISOString().slice(0, 10),
                  lastPaidAmount: amt,
                  paymentHistory: [
                    ...(p.paymentHistory ?? []),
                    { date: new Date().toISOString(), amount: amt },
                  ],
                });
                setPayId(null);
              }}
            >
              <div className="mb-4">
                <div className="flex justify-between py-2 border-b border-neutral-200 text-sm">
                  <span className="text-neutral-500">{p.item} · {supplierName(p.supplierId)}</span>
                  <span className="tabular-nums">{fmtDate(p.date)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-neutral-200 text-sm">
                  <span className="text-neutral-500">Total Purchase Cost</span>
                  <span className="tabular-nums">{fmtMoney(total)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-neutral-200 text-sm">
                  <span className="text-neutral-500">Already Paid</span>
                  <span className="tabular-nums">{fmtMoney(paid)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-neutral-200 text-sm">
                  <span className="text-neutral-500">Remaining Due</span>
                  <span className="tabular-nums">{fmtMoney(rem)}</span>
                </div>
              </div>
              {history.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
                    Payment History
                  </p>
                  {[...history].reverse().map((h, i) => (
                    <div
                      key={i}
                      className="flex justify-between py-1.5 border-b border-dashed border-neutral-200 last:border-b-0 text-sm"
                    >
                      <span className="text-neutral-500 tabular-nums">{fmtDateTime(h.date)}</span>
                      <span className="tabular-nums font-medium">{fmtMoney(h.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <label>Amount to Pay</label>
              <input
                type="number"
                min="0"
                max={rem}
                placeholder="0"
                value={numVal(payAmount)}
                onChange={(e) => setPayAmount(Number(e.target.value))}
                required
              />
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" className="btn-ghost" onClick={() => setPayId(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Record Payment</button>
              </div>
            </form>
          );
        })()}
      </Modal>
    </Page>
  );
}
