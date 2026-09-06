"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useStore,
  saleTotal,
  saleGrandTotal,
} from "@/lib/store";
import { Page, PageTitle, Modal, useToggle, EmptyState } from "@/components/ui";
import SaleDetailModal from "@/components/SaleDetailModal";
import {
  fmtMoney,
  fmtQtyWithUnit,
  fmtRateWithUnit,
  fmtDate,
  qtyUnitLabel,
} from "@/lib/format";

interface LineForm {
  product: string;
  item: string;
  quality: string;
  supplierId: string;
  purchaseId?: string;
  qty: number;
  rate: number; // locked from inventory selling price
}

const numVal = (n: number) => (n === 0 ? "" : String(n));

export default function SalesPage() {
  const { sales, customers, inventory, suppliers, inventoryBySource, stockLots, addSale, addPayment, addCustomer } = useStore();
  const [viewId, setViewId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  // customer add (the only popup left — a secondary action)
  const { open: newCustOpen, onOpen: onNewCustOpen, onClose: onNewCustClose } = useToggle();
  const [newCust, setNewCust] = useState({ name: "", shop: "", phone: "" });

  /* ---- sale header ---- */
  const [existingId, setExistingId] = useState(customers[0]?.id ?? "");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [discountPct, setDiscountPct] = useState(0);
  const [taxPct, setTaxPct] = useState(0);
  const [paidNow, setPaidNow] = useState(0);

  /* ---- sellable stock rows ---- */
  const invMap = Object.fromEntries(inventory.map((r) => [r.item, r]));
  const unitOf = (item: string) => invMap[item]?.unit ?? "";
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "—";

  const sourceRows = inventoryBySource.filter((r) => r.stockQty > 0);
  const sourceStockOf = (item: string, supplierId: string) =>
    inventoryBySource.find((r) => r.item === item && r.supplierId === supplierId)?.stockQty ?? 0;
  const sourceUnitCostOf = (item: string, supplierId: string) =>
    inventoryBySource.find((r) => r.item === item && r.supplierId === supplierId)?.landedAvg ?? 0;
  const sellPriceOf = (item: string, quality: string, supplierId: string) =>
    stockLots.find(
      (l) => l.item === item && l.quality === quality && l.supplierId === supplierId && l.sellPrice
    )?.sellPrice;

  const productsWithStock = Array.from(
    new Set(sourceRows.map((r) => r.product))
  ).filter((p): p is string => !!p).sort();
  const itemsOf = (product: string) => sourceRows.filter((r) => r.product === product);
  const qualitiesOf = (item: string) =>
    Array.from(new Set(sourceRows.filter((r) => r.item === item && r.quality).map((r) => r.quality as string)));
  const sourcesOf = (item: string, quality = "") =>
    sourceRows.filter((r) => r.item === item && (!quality || r.quality === quality));

  /* ---- the "add item" draft ---- */
  interface Draft { product: string; item: string; quality: string; supplierId: string; qty: number; }
  const freshDraft = (): Draft => {
    const prod = productsWithStock[0] ?? "";
    const itemRow = itemsOf(prod)[0];
    const qual = (itemRow?.quality ?? "") || "";
    const src = sourcesOf(itemRow?.item ?? "", qual)[0];
    return {
      product: prod,
      item: itemRow?.item ?? "",
      quality: qual,
      supplierId: src?.supplierId ?? "",
      qty: 1,
    };
  };
  const [draft, setDraft] = useState<Draft>(freshDraft);

  const onDraftProduct = (product: string) => {
    const row = itemsOf(product)[0];
    const item = row?.item ?? "";
    const qual = (row?.quality ?? "") || "";
    setDraft({
      ...freshDraft(),
      product,
      item,
      quality: qual,
      supplierId: sourcesOf(item, qual)[0]?.supplierId ?? "",
      qty: 1,
    });
  };
  const onDraftItem = (item: string) => {
    const qual = qualitiesOf(item)[0] ?? "";
    setDraft((d) => ({
      ...d,
      item,
      quality: qual,
      supplierId: sourcesOf(item, qual)[0]?.supplierId ?? "",
      qty: 1,
    }));
  };
  const onDraftQuality = (quality: string) => {
    setDraft((d) => ({
      ...d,
      quality,
      supplierId: sourcesOf(d.item, quality)[0]?.supplierId ?? "",
      qty: 1,
    }));
  };

  /* ---- added lines ---- */
  const [lines, setLines] = useState<LineForm[]>([]);

  // stock still available for a draft combo = source stock minus what's already on the sale
  const availOf = (item: string, quality: string, supplierId: string) => {
    const total = sourceStockOf(item, supplierId);
    const used = lines
      .filter((l) => l.item === item && l.quality === quality && l.supplierId === supplierId)
      .reduce((a, l) => a + (Number(l.qty) || 0), 0);
    return Math.max(0, total - used);
  };
  const draftAvail = availOf(draft.item, draft.quality, draft.supplierId);
  const draftOver = (Number(draft.qty) || 0) > draftAvail;

  const subtotal = lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0);
  const discAmt = subtotal * (discountPct / 100);
  const taxable = subtotal - discAmt;
  const taxAmt = taxable * (taxPct / 100);
  const grandTotal = taxable + taxAmt;
  const remaining = Math.max(0, grandTotal - (Number(paidNow) || 0));
  const canAdd = !!draft.item && !!draft.supplierId && !draftOver && (Number(draft.qty) || 0) > 0;
  const lineOver = (l: LineForm) => (Number(l.qty) || 0) > sourceStockOf(l.item, l.supplierId);
  const canSave =
    lines.length > 0 &&
    lines.every((l) => l.item && l.supplierId && (Number(l.qty) || 0) > 0 && (Number(l.rate) || 0) > 0 && !lineOver(l)) &&
    !!existingId;

  const setLine = (i: number, patch: Partial<LineForm>) =>
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const addDraftItem = () => {
    if (!canAdd) return;
    const unitCost = sourceUnitCostOf(draft.item, draft.supplierId);
    const price = sellPriceOf(draft.item, draft.quality, draft.supplierId);
    setLines((prev) => [
      ...prev,
      {
        product: draft.product,
        item: draft.item,
        quality: draft.quality,
        supplierId: draft.supplierId,
        purchaseId:
          stockLots.find(
            (l) => l.item === draft.item && l.quality === draft.quality && l.supplierId === draft.supplierId
          )?.purchaseId ?? undefined,
        qty: Number(draft.qty) || 1,
        rate: Math.round(price ?? (unitCost * 1.15)) || 0,
      },
    ]);
    setDraft((d) => ({ ...d, qty: 1 }));
  };

  const startNewSale = () => {
    setLines([]);
    setDiscountPct(0);
    setTaxPct(0);
    setPaidNow(0);
    setDraft(freshDraft());
    setSaleDate(new Date().toISOString().slice(0, 10));
    setExistingId(customers[0]?.id ?? "");
    setNewOpen(true);
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
    const saleId = addSale({
      date: saleDate,
      customerId: existingId,
      discountPct,
      taxPct,
      lines: lines.map((l) => ({
        item: l.item,
        qty: Number(l.qty),
        rate: Number(l.rate),
        unit: unitOf(l.item),
        supplierId: l.supplierId || undefined,
        purchaseId: l.purchaseId || undefined,
      })),
    });
    if ((Number(paidNow) || 0) > 0) {
      addPayment({
        date: saleDate,
        type: "customer",
        partyId: existingId,
        amount: Math.min(Number(paidNow), grandTotal),
        method: "Cash",
        note: "Paid at time of sale",
        saleId,
      });
    }
    setLines([]);
    setNewOpen(false);
    setViewId(saleId);
  };

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? id;
  const customer = customers.find((c) => c.id === existingId);
  const draftUnit = unitOf(draft.item);
  const draftPrice = draft.item && draft.supplierId ? sellPriceOf(draft.item, draft.quality, draft.supplierId) : undefined;

  return (
    <Page>
      {/* ================= SALES LIST ================= */}
      <PageTitle
        title="Sales"
        sub="Stock sold to customers — invoices are generated automatically"
        action={
          <button className="btn-primary" onClick={startNewSale}>
            + New Sale
          </button>
        }
      />

      {sales.length === 0 ? (
        <EmptyState
          emoji={inventory.length > 0 ? "🧾" : "🏗️"}
          title={inventory.length > 0 ? "No sales yet" : "Nothing to sell yet"}
          hint={
            inventory.length > 0
              ? "Sell from your stock — the invoice is created automatically."
              : "Record a purchase first — once stock lands, sales take a minute."
          }
          action={
            inventory.length > 0 ? (
              <button className="btn-primary" onClick={startNewSale}>
                + New Sale
              </button>
            ) : (
              <Link href="/purchases" className="btn-primary">
                + Add Purchase
              </Link>
            )
          }
        />
      ) : (
      <div className="border border-neutral-200 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Items</th>
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
                    {s.lines
                      .map((l) => {
                        const src = l.supplierId ? ` (${supplierName(l.supplierId)})` : "";
                        return `${l.item} × ${fmtQtyWithUnit(l.qty, l.unit)} @ ${fmtRateWithUnit(l.rate, l.unit)}${src}`;
                      })
                      .join(", ")}
                  </td>
                  <td className="num font-medium">
                    {fmtMoney(saleGrandTotal(s))}
                    {(s.discountPct ?? 0) > 0 || (s.taxPct ?? 0) > 0 ? (
                      <span className="block text-[10px] text-neutral-400 font-normal">
                        {saleTotal(s) > saleGrandTotal(s) ? "incl. discount" : ""}
                        {(s.taxPct ?? 0) > 0 ? `${(s.discountPct ?? 0) > 0 ? " · " : ""}${(s.taxPct ?? 0)}% tax` : ""}
                      </span>
                    ) : null}
                  </td>
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
      )}

      {/* ================= NEW SALE — large overlay popup (~80% of screen) ================= */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New Sale" full>
        <form onSubmit={submit}>
          {/* header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h1 className="text-[22px] sm:text-2xl font-semibold tracking-tight">New Sale</h1>
            <div className="flex gap-2.5">
              <button type="button" className="btn-ghost" onClick={() => setNewOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={!canSave}>Save Sale</button>
            </div>
          </div>

          {/* two-column workspace */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 items-start">
            {/* ---- left: customer + items ---- */}
            <div className="min-w-0">
              {/* customer & date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
                <div>
                  <label>Date</label>
                  <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} required />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="!mb-0">Customer</label>
                    <button type="button" onClick={onNewCustOpen} className="text-xs underline underline-offset-2 hover:text-neutral-500">
                      + New Customer
                    </button>
                  </div>
                  <select value={existingId} onChange={(e) => setExistingId(e.target.value)} className="w-full">
                    {customers.length === 0 && <option value="">No customers yet — add one</option>}
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} — {c.shop}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ---- add-item strip (always visible) ---- */}
              <div className="mt-8 border border-neutral-200 rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <label className="!mb-0 text-[12px]">Add Item</label>
                  {inventory.length === 0 || productsWithStock.length === 0 ? (
                    <span className="text-xs text-neutral-400">No stock yet — record a purchase first</span>
                  ) : (
                    <span className="text-xs text-neutral-400">Price is auto-set from inventory</span>
                  )}
                </div>

                {inventory.length === 0 || productsWithStock.length === 0 ? null : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                      <div>
                        <label className="!mb-1">Product</label>
                        <select value={draft.product} onChange={(e) => onDraftProduct(e.target.value)}>
                          {productsWithStock.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="!mb-1">Product Item</label>
                        <select value={draft.item} onChange={(e) => onDraftItem(e.target.value)}>
                          {itemsOf(draft.product).map((r) => <option key={r.item} value={r.item}>{r.item}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="!mb-1">Quality</label>
                        <select value={draft.quality} onChange={(e) => onDraftQuality(e.target.value)}>
                          <option value="">Any quality</option>
                          {qualitiesOf(draft.item).map((q) => <option key={q} value={q}>{q}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="!mb-1">Mill / Source</label>
                        <select value={draft.supplierId} onChange={(e) => setDraft((d) => ({ ...d, supplierId: e.target.value, qty: 1 }))}>
                          <option value="" disabled>
                            {sourcesOf(draft.item, draft.quality).length === 0 ? "No stock…" : "Select mill…"}
                          </option>
                          {sourcesOf(draft.item, draft.quality).map((r) => (
                            <option key={r.supplierId} value={r.supplierId ?? ""} disabled={r.stockQty <= 0}>
                              {supplierName(r.supplierId ?? "")} — {fmtQtyWithUnit(availOf(draft.item, draft.quality, r.supplierId ?? ""), r.unit)} left
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="!mb-1">Qty ({qtyUnitLabel(draftUnit)})</label>
                        <input
                          type="number" min="0" max={draftAvail || undefined} step="any"
                          value={numVal(draft.qty)}
                          onChange={(e) => setDraft((d) => ({ ...d, qty: Number(e.target.value) }))}
                          className={draftOver ? "!border-red-600" : ""}
                        />
                      </div>
                    </div>

                    {draftOver && (
                      <p className="text-[11px] text-red-600 mt-1.5">
                        Only {fmtQtyWithUnit(draftAvail, draftUnit)} available of this mill&apos;s stock.
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-neutral-500">
                        {draft.item && draft.supplierId ? (
                          <>
                            <span className="font-medium text-neutral-700">{draft.item}</span>
                            {draft.quality ? ` · ${draft.quality}` : ""} · {supplierName(draft.supplierId)}
                            {draftPrice ? (
                              <span className="ml-2 text-neutral-600 tabular-nums">
                                @ {fmtRateWithUnit(draftPrice, draftUnit)}
                              </span>
                            ) : (
                              <span className="ml-2 text-neutral-400">no sell price set</span>
                            )}
                          </>
                        ) : (
                          "Pick an item and mill to add it"
                        )}
                      </div>
                      <button type="button" className="btn-primary !py-2 !px-4 text-xs" onClick={addDraftItem} disabled={!canAdd}>
                        + Add Item
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* ---- added items ---- */}
              <div className="mt-8">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <label className="!mb-0 text-[12px]">Items on this invoice</label>
                  <span className="text-xs text-neutral-400 tabular-nums">{lines.length} item{lines.length === 1 ? "" : "s"}</span>
                </div>

                {lines.length === 0 ? (
                  <div className="border border-dashed border-neutral-300 p-8 text-center">
                    <p className="text-sm text-neutral-400">Nothing added yet</p>
                    <p className="text-xs text-neutral-400 mt-1">Pick a product above and press “+ Add Item”.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {lines.map((l, i) => {
                      const unit = unitOf(l.item);
                      const over = lineOver(l);
                      const rate = Number(l.rate) || 0;
                      const qty = Number(l.qty) || 0;
                      return (
                        <div key={i} className="border border-neutral-200 rounded-xl bg-white overflow-hidden">
                          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[#171717] leading-tight truncate">{l.item}</p>
                              <p className="text-[11px] text-neutral-400 truncate">
                                {l.quality ? `${l.quality} · ` : ""}{supplierName(l.supplierId)}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div>
                                <label className="!mb-0.5 text-[10px] uppercase tracking-widest text-neutral-400">Qty ({qtyUnitLabel(unit)})</label>
                                <input
                                  type="number" min="0" step="any" className="!w-28"
                                  value={numVal(l.qty)}
                                  onChange={(e) => setLine(i, { qty: Number(e.target.value) })}
                                  required
                                />
                                {over && <p className="text-[10px] text-red-600">Over stock!</p>}
                              </div>
                              <div>
                                <label className="!mb-0.5 text-[10px] uppercase tracking-widest text-neutral-400">Price</label>
                                <div className="border px-3 py-2 text-sm bg-neutral-50 text-neutral-700 tabular-nums whitespace-nowrap">
                                  {rate > 0 ? fmtRateWithUnit(rate, unit) : "—"}
                                </div>
                              </div>
                              <div className="text-right">
                                <label className="!mb-0.5 block text-[10px] uppercase tracking-widest text-neutral-400">Amount</label>
                                <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{fmtMoney(qty * rate)}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                                className="text-neutral-400 hover:text-red-600 text-sm ml-1"
                                title="Remove item"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ---- right: compact totals panel ---- */}
            <div className="min-w-0">
              <div className="border border-neutral-200 rounded-xl bg-white p-5 xl:sticky xl:top-6">
                <p className="text-xs uppercase tracking-widest text-neutral-500 mb-4">Summary</p>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-neutral-500">Subtotal</span>
                    <span className="tabular-nums font-medium">{fmtMoney(subtotal)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="!mb-1">Discount (%)</label>
                      <input type="number" min="0" max="100" step="any" placeholder="0" value={numVal(discountPct)} onChange={(e) => setDiscountPct(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="!mb-1">Tax (%)</label>
                      <input type="number" min="0" max="100" step="any" placeholder="0" value={numVal(taxPct)} onChange={(e) => setTaxPct(Number(e.target.value))} />
                    </div>
                  </div>
                  {discAmt > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-neutral-500">Discount</span>
                      <span className="tabular-nums text-neutral-500">− {fmtMoney(discAmt)}</span>
                    </div>
                  )}
                  {taxAmt > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-neutral-500">Tax</span>
                      <span className="tabular-nums text-neutral-500">+ {fmtMoney(taxAmt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2.5 px-3 bg-black text-white -mx-3">
                    <span className="text-xs uppercase tracking-widest text-neutral-400">Grand Total</span>
                    <span className="tabular-nums font-semibold">{fmtMoney(grandTotal)}</span>
                  </div>
                  <div>
                    <label className="!mb-1">Paid Now</label>
                    <input type="number" min="0" step="any" placeholder="0" value={numVal(paidNow)} onChange={(e) => setPaidNow(Number(e.target.value))} />
                  </div>
                  <div className={`flex justify-between items-center px-3 py-2.5 border border-dashed -mx-3 ${remaining > 0 ? "border-neutral-400" : "border-neutral-300"}`}>
                    <span className="text-xs uppercase tracking-widest text-neutral-500">Remaining Due</span>
                    <span className={`tabular-nums font-semibold ${remaining > 0 ? "" : "text-neutral-400"}`}>{fmtMoney(remaining)}</span>
                  </div>
                </div>

                <button type="submit" className="btn-primary w-full mt-5" disabled={!canSave}>
                  Save Sale
                </button>
                <p className="text-[11px] text-neutral-400 text-center mt-2.5">
                  Invoice for {customer?.name ?? "customer"} created on save
                </p>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <SaleDetailModal saleId={viewId} onClose={() => setViewId(null)} />

      {/* add customer popup — the only popup left */}
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
