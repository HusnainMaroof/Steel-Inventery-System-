"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, purchaseTotal, steelAmount } from "@/lib/store";
import { Page, PageTitle, Modal, useToggle, EmptyState } from "@/components/ui";
import { fmtMoney, fmtQtyWithUnit, fmtRateWithUnit, fmtDate, fmtDateTime, qtyUnitLabel, perUnitLabel } from "@/lib/format";
import type { Purchase } from "@/lib/types";

export default function PurchasesPage() {
  const { purchases, suppliers, inventory, products, productItems, qualities, addPurchase, updatePurchase, deletePurchase } = useStore();
  const { open, onOpen, onClose } = useToggle();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "dues">("all");
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    supplierId: suppliers[0]?.id ?? "",
    productId: products[0]?.id ?? "",
    item: "",
    quality: "",
    qty: 0,
    rate: 0,
    transport: 0,
    otherCost: 0,
    sellRate: 0,
    paidNow: 0,
  });

  // the unit comes from the selected product — never a manual pick
  const productUnit =
    products.find((p) => p.id === form.productId)?.unit ?? "";
  const qtyLabel = qtyUnitLabel(productUnit);
  const perLabel = perUnitLabel(productUnit);
  const totalStock = form.qty * form.rate;
  const totalCost = totalStock + form.transport + form.otherCost;
  const landedPerUnit = form.qty > 0 ? totalCost / form.qty : 0;
  const marginPerUnit = form.sellRate > 0 ? form.sellRate - landedPerUnit : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const { paidNow, ...rest } = form;
    addPurchase({
      ...rest,
      product: products.find((p) => p.id === form.productId)?.name ?? "",
      unit: productUnit, // snapshot the product's unit at entry
      qty: Number(rest.qty),
      rate: Number(rest.rate),
      transport: Number(rest.transport),
      otherCost: Number(rest.otherCost),
      sellRate: Number(rest.sellRate) || undefined,
      paid: Number(paidNow) || 0,
      lastPaidAt: rest.date,
      lastPaidAmount: Number(paidNow) || 0,
      paymentHistory:
        Number(paidNow) > 0
          ? [{ date: new Date().toISOString(), amount: Number(paidNow) }]
          : [],
    });
    onClose();
    // reset the numeric fields so the next entry starts clean
    setForm((f) => ({
      ...f,
      item: "",
      quality: "",
      qty: 0,
      rate: 0,
      transport: 0,
      otherCost: 0,
      sellRate: 0,
      paidNow: 0,
    }));
  };

  const supplierName = (id: string) =>
    suppliers.find((s) => s.id === id)?.name ?? id;

  // show 0 values as an empty field instead of a literal "0"
  const numVal = (v: number) => (v === 0 ? "" : v);

  // due to the MILL is the steel amount only (transport & other costs are on us)
  const remainingOf = (p: Purchase) =>
    Math.max(0, steelAmount(p) - (p.paid ?? 0));

  const duePurchases = purchases.filter((p) => remainingOf(p) > 0);
  const totalDue = duePurchases.reduce((a, p) => a + remainingOf(p), 0);

  const removePurchase = (p: Purchase) => {
    if (
      window.confirm(
        `Delete this purchase?\n\n${p.item} · ${fmtQtyWithUnit(p.qty, p.unit)} · ${fmtDate(p.date)}\n\nAll its details and payment records will be permanently removed.`
      )
    ) {
      deletePurchase(p.id);
      if (selectedId === p.id) setSelectedId(null);
      if (payId === p.id) setPayId(null);
    }
  };

  const selected = purchases.find((p) => p.id === selectedId) ?? null;
  let detailRows: { label: string; value: string; strong?: boolean; muted?: boolean }[] = [];
  if (selected) {
    const total = purchaseTotal(selected);
    const costPerUnit = selected.qty > 0 ? total / selected.qty : 0;
    const avgSellPerUnit =
      inventory.find((r) => r.item === selected.item)?.avgSellRate ?? 0;
    // profit is based on YOUR selling price; average market rate is only a fallback
    const usedSell = selected.sellRate ?? avgSellPerUnit;
    const perUnit = perUnitLabel(selected.unit);
    const profitPerUnit = usedSell > 0 ? usedSell - costPerUnit : 0;
    const payable = steelAmount(selected);
    const paid = selected.paid ?? 0;
    const remaining = Math.max(0, payable - paid);
    detailRows = [
      { label: "Purchase Date", value: fmtDate(selected.date) },
      { label: "Supplier", value: supplierName(selected.supplierId) },
      { label: "Product", value: selected.product || "—" },
      { label: "Product Item", value: selected.item },
      { label: "Quality", value: selected.quality || "—" },
      { label: "Quantity", value: fmtQtyWithUnit(selected.qty, selected.unit) },
      { label: "Buying Price", value: fmtRateWithUnit(selected.rate, selected.unit) },
      { label: "Transport Cost", value: fmtMoney(selected.transport), muted: true },
      { label: "Other Expenses", value: fmtMoney(selected.otherCost), muted: true },
      { label: "Actual Cost" + perUnit, value: fmtMoney(costPerUnit), muted: true },
      // ——— payment summary: what the mill gets ———
      { label: "Total Payable to Mill", value: fmtMoney(payable) },
      { label: "Already Paid", value: fmtMoney(paid), muted: true },
      { label: "Remaining Due", value: fmtMoney(remaining), strong: remaining > 0, muted: remaining === 0 },
      // ——— your margins ———
      { label: "Your Selling Price", value: fmtRateWithUnit(usedSell, selected.unit) },
      { label: "Profit" + perUnit, value: fmtMoney(profitPerUnit), strong: true },
    ];
  }

  return (
    <Page>
      <PageTitle
        title="Purchases"
        sub="Stock bought from suppliers, including delivery and other costs"
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

      {tab === "all" &&
        (purchases.length === 0 ? (
          <EmptyState
            emoji="🚚"
            title="No purchases yet"
            hint={
              suppliers.length === 0
                ? "Add a mill / supplier first, then your first purchase will feel right at home."
                : "Record your first purchase — date, supplier and rate is all it takes."
            }
            action={
              <button className="btn-primary" onClick={onOpen}>
                + Add Purchase
              </button>
            }
          />
        ) : (
      <div className="border border-neutral-200 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Purchase Date</th>
              <th>Supplier</th>
              <th>Item</th>
              <th className="num">Quantity</th>
              <th className="num">Buying Price</th>
              <th className="num">Your Selling Price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {purchases.map((p) => {
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
                  <td className="num">{fmtQtyWithUnit(p.qty, p.unit)}</td>
                  <td className="num">{fmtRateWithUnit(p.rate, p.unit)}</td>
                  <td className={`num ${p.sellRate ? "" : "text-neutral-400"}`}>
                    {p.sellRate ? fmtRateWithUnit(p.sellRate, p.unit) : "—"}
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
        ))}

      {tab === "dues" && (
        <div>
          <div className="border border-neutral-200 p-4 mb-4 flex justify-between items-center">
            <span className="text-xs uppercase tracking-widest text-neutral-500">
              Total Outstanding to Suppliers
            </span>
            <span className="font-medium tabular-nums text-lg">{fmtMoney(totalDue)}</span>
          </div>

          {duePurchases.length === 0 ? (
            <div className="border border-dashed border-neutral-300">
              <EmptyState
                emoji="🎉"
                compact
                title="No pending dues"
                hint="Every purchase is fully paid — the mills are smiling today."
              />
            </div>
          ) : (
            <div className="border border-neutral-200 overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Purchase Date</th>
                    <th>Supplier</th>
                    <th>Product Type</th>
                    <th className="num">Total Payable to Mill</th>
                    <th className="num">Paid</th>
                    <th className="num">Remaining</th>
                    <th className="num">Last Payment</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {duePurchases.map((p) => {
                    const total = steelAmount(p); // mill due = steel only
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
          <div>
            <label>Product</label>
            <select
              value={form.productId}
              onChange={(e) => {
                const v = e.target.value;
                // auto-select the first item of the product to save a click
                const firstItem = productItems.find((i) => i.productId === v)?.name ?? "";
                setForm({ ...form, productId: v, item: firstItem });
              }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Product Item</label>
            <select
              value={form.item}
              onChange={(e) => setForm({ ...form, item: e.target.value })}
              required
            >
              <option value="" disabled>
                Select item…
              </option>
              {productItems
                .filter((i) => i.productId === form.productId)
                .map((i) => (
                  <option key={i.id} value={i.name}>{i.name}</option>
                ))}
            </select>
          </div>
          <div>
            <label>Quality</label>
            <select
              value={form.quality}
              onChange={(e) => setForm({ ...form, quality: e.target.value })}
            >
              <option value="">Not specified</option>
              {qualities.map((q) => (
                <option key={q.id} value={q.name}>{q.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Unit</label>
            <input value={qtyUnitLabel(productUnit) || "—"} disabled className="!bg-neutral-50 !text-neutral-600" />
          </div>
          <div>
            <label>Quantity ({qtyLabel})</label>
            <input type="number" min="0.1" step="any" placeholder="0" value={numVal(form.qty)} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} required />
          </div>
          <div>
            <label>Buying Price ({perLabel})</label>
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
          <div className="col-span-2 grid grid-cols-2 gap-4">
            <div>
              <label>Your Selling Price ({perLabel})</label>
              <input type="number" min="0" placeholder="0" value={numVal(form.sellRate)} onChange={(e) => setForm({ ...form, sellRate: Number(e.target.value) })} />
            </div>
            <div>
              <label>Paid Now (to supplier)</label>
              <input type="number" min="0" placeholder="0" value={numVal(form.paidNow)} onChange={(e) => setForm({ ...form, paidNow: Number(e.target.value) })} />
            </div>
          </div>
          <div className="col-span-2 border border-dashed border-neutral-400 p-3 flex justify-between items-center">
            <div>
              <span className="block text-xs uppercase tracking-widest text-neutral-500">
                Total Amount
              </span>
              <span className="block text-xs text-neutral-400 mt-1">
                {form.qty || 0} {qtyLabel} × {fmtMoney(form.rate)}{perLabel}
              </span>
            </div>
            <span className="font-medium tabular-nums text-right shrink-0">
              {fmtMoney(totalStock).replace("₨ ", "")}
              <span className="text-neutral-400 text-xs ml-1">₨</span>
            </span>
          </div>
          {form.sellRate > 0 && (
            <div className="col-span-2 border border-dashed border-neutral-400 p-3 flex justify-between items-center">
              <div>
                <span className="block text-xs uppercase tracking-widest text-neutral-500">
                  Expected Profit ({perLabel})
                </span>
                <span className="block text-xs text-neutral-400 mt-1">
                  sell {fmtMoney(form.sellRate)}{perLabel} − cost {fmtMoney(landedPerUnit)}{perLabel}
                </span>
              </div>
              <span className={`font-medium tabular-nums text-right shrink-0 ${marginPerUnit < 0 ? "text-red-600" : ""}`}>
                {marginPerUnit < 0 ? "− " : ""}{fmtMoney(Math.abs(marginPerUnit)).replace("₨ ", "")}
                <span className="text-neutral-400 text-xs ml-1">₨</span>
              </span>
            </div>
          )}
          <div className="col-span-2 border border-dashed border-neutral-400 p-3 flex justify-between items-center">
            <div>
              <span className="block text-xs uppercase tracking-widest text-neutral-500">
                Actual Cost ({perLabel})
              </span>
              <span className="block text-xs text-neutral-400 mt-1">
                product + transport + expenses, per {qtyUnitLabel(productUnit) || "unit"}
              </span>
            </div>
            <span className="font-medium tabular-nums text-right shrink-0">
              {fmtMoney(landedPerUnit).replace("₨ ", "")}
              <span className="text-neutral-400 text-xs ml-1">₨</span>
            </span>
          </div>
          <div className="col-span-2 border border-dashed border-neutral-800 p-3 flex justify-between items-center bg-black text-white">
            <div>
              <span className="block text-xs uppercase tracking-widest text-neutral-400">
                Remaining Due to Supplier
              </span>
              <span className="block text-xs text-neutral-500 mt-1">
                total {fmtMoney(totalStock)} − paid {fmtMoney(Number(form.paidNow) || 0)}
              </span>
            </div>
            <span className="font-medium tabular-nums text-right shrink-0">
              {fmtMoney(Math.max(0, totalStock - Number(form.paidNow || 0))).replace("₨ ", "")}
              <span className="text-neutral-500 text-xs ml-1">₨</span>
            </span>
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
                  r.muted ? "text-neutral-400" : r.strong ? "" : "text-neutral-500"
                }`}
              >
                {r.label}
              </span>
              <span
                className={`tabular-nums text-right shrink-0 ${
                  r.muted ? "text-neutral-400" : "font-medium"
                }`}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
        {selected && (
          <div className="flex justify-between items-center mt-4">
            <p className="text-xs text-neutral-500">
              Profit = Your Selling Price − Actual Cost, shown per unit of this product&apos;s unit of measure.
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
          const total = steelAmount(p); // mill due = steel only
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
                  <span className="text-neutral-500">Total Payable to Mill</span>
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
