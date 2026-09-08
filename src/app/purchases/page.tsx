"use client";

import { useState, useMemo } from "react";
import { useStore, purchaseTotal, steelAmount } from "@/lib/store";
import { Page, PageTitle, Modal, ConfirmModal, useToggle, EmptyState } from "@/components/ui";
import { fmtMoney, fmtQtyWithUnit, fmtRateWithUnit, fmtDate, fmtDateTime, qtyUnitLabel, perUnitLabel } from "@/lib/format";
import type { Purchase } from "@/lib/types";

export default function PurchasesPage() {
  const { purchases, suppliers, inventory, products, productItems, qualities, sales, addPurchase, updatePurchase, deletePurchase, addPayment, addQuality } = useStore();
  const { open, onOpen, onClose } = useToggle();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "dues">("all");
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payError, setPayError] = useState("");
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    supplierId: suppliers[0]?.id ?? "",
    productId: products[0]?.id ?? "",
    item: "",
    spec: "",
    quality: "",
    qty: 0,
    rate: 0,
    transport: 0,
    otherCost: 0,
    sellRate: 0,
    paidNow: 0,
  });

  const formProduct = products.find((p) => p.id === form.productId);
  const productUnit = formProduct?.unit ?? "";
  // what the secondary picker means for this product — "Quality" by default,
  // "Factory / Mill" when buying Cement
  const specLabelOf = (productName?: string) => {
    const pr = products.find((x) => x.name === productName);
    const custom = pr?.specLabel ?? (productName?.toLowerCase().includes("cement") ? "Factory / Mill" : undefined);
    return custom ?? "Quality";
  };
  const specLabel = formProduct
    ? specLabelOf(formProduct.name)
    : "Quality";
  const qtyLabel = qtyUnitLabel(productUnit);
  const perLabel = perUnitLabel(productUnit);
  const totalStock = form.qty * form.rate;
  const totalCost = totalStock + form.transport + form.otherCost;
  const landedPerUnit = form.qty > 0 ? totalCost / form.qty : 0;
  const marginPerUnit = form.sellRate > 0 ? form.sellRate - landedPerUnit : 0;

  const openAdd = () => {
    setFormError("");
    onOpen();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const paidNow = Number(form.paidNow) || 0;
    if (paidNow > totalStock + 0.001) {
      setFormError(`Amount paid (${fmtMoney(paidNow)}) can't be more than this purchase's total of ${fmtMoney(totalStock)}.`);
      return;
    }
    setFormError("");
    // type-in support: whatever spec / quality the user typed and is not on
    // the list yet is saved against this product on the spot
    const isCustomSpec = specLabel !== "Quality";
    const specName = form.spec.trim();
    const qualName = form.quality.trim();
    const known = (name: string) =>
      qualities.some(
        (q) =>
          q.name.toLowerCase() === name.toLowerCase() &&
          (!q.productId || q.productId === form.productId)
      );
    if (specName && isCustomSpec && !known(specName)) addQuality(form.productId, specName, true);
    if (qualName && !known(qualName)) addQuality(form.productId, qualName);
    addPurchase({
      date: form.date,
      supplierId: form.supplierId,
      product: products.find((p) => p.id === form.productId)?.name ?? "",
      item: form.item,
      spec: isCustomSpec ? specName || undefined : undefined,
      quality: qualName || undefined,
      qty: Number(form.qty),
      unit: productUnit,
      rate: Number(form.rate),
      transport: Number(form.transport),
      otherCost: Number(form.otherCost),
      sellRate: Number(form.sellRate) || undefined,
      paid: paidNow,
      lastPaidAt: form.date,
      lastPaidAmount: paidNow,
      paymentHistory: paidNow > 0 ? [{ date: new Date().toISOString(), amount: paidNow }] : [],
    });
    onClose();
    setForm((f) => ({ ...f, item: "", spec: "", quality: "", qty: 0, rate: 0, transport: 0, otherCost: 0, sellRate: 0, paidNow: 0 }));
  };

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? id;
  const numVal = (v: number) => (v === 0 ? "" : v);
  const openPay = (id: string) => { setPayId(id); setPayAmount(0); setPayError(""); };
  const closePay = () => { setPayId(null); setPayError(""); };
  const remainingOf = (p: Purchase) => Math.max(0, steelAmount(p) - (p.paid ?? 0));
  const duePurchases = purchases.filter((p) => remainingOf(p) > 0);
  const totalDue = duePurchases.reduce((a, p) => a + remainingOf(p), 0);

  const confirmDeletePurchase = () => {
    if (!deleteTarget) return;
    const p = deleteTarget;
    deletePurchase(p.id);
    if (selectedId === p.id) setSelectedId(null);
    if (payId === p.id) setPayId(null);
    setDeleteTarget(null);
  };

  // Date-grouped purchases
  const purchaseDateGroups = useMemo(() => {
    const sorted = [...purchases].sort((a, b) => b.date.localeCompare(a.date));
    const map = new Map<string, Purchase[]>();
    for (const p of sorted) {
      const list = map.get(p.date) ?? [];
      list.push(p);
      map.set(p.date, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({
        date,
        rows: items.map((p) => ({
          id: p.id,
          product: p.product,
          quality: p.quality,
          spec: p.spec,
          supplier: supplierName(p.supplierId),
          item: p.item,
          qty: p.qty,
          unit: p.unit,
          rate: p.rate,
          sellRate: p.sellRate,
        })),
        dayTotal: items.reduce((a, p) => a + steelAmount(p), 0),
      }));
  }, [purchases, suppliers]);

  // Date-grouped dues
  const dueDateGroups = useMemo(() => {
    const sorted = [...duePurchases].sort((a, b) => b.date.localeCompare(a.date));
    const map = new Map<string, Purchase[]>();
    for (const p of sorted) {
      const list = map.get(p.date) ?? [];
      list.push(p);
      map.set(p.date, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({
        date,
        rows: items.map((p) => ({
          id: p.id,
          product: p.product,
          quality: p.quality,
          spec: p.spec,
          supplier: supplierName(p.supplierId),
          item: p.item,
          totalPayable: steelAmount(p),
          paid: p.paid ?? 0,
          remaining: remainingOf(p),
          lastPaidAt: p.lastPaidAt,
        })),
        dayTotal: items.reduce((a, p) => a + steelAmount(p), 0),
        dayPaid: items.reduce((a, p) => a + (p.paid ?? 0), 0),
      }));
  }, [duePurchases, suppliers]);

  const selected = purchases.find((p) => p.id === selectedId) ?? null;

  return (
    <Page>
      <PageTitle
        title="Purchases"
        sub="Stock bought from suppliers, including delivery and other costs"
        action={<button className="btn-primary" onClick={openAdd}>+ Add Purchase</button>}
      />

      <div className="flex gap-6 border-b border-neutral-200 mb-4">
        {([
          ["all", "All Purchases"],
          ["dues", `Payment Dues${totalDue > 0 ? ` (${duePurchases.length})` : ""}`],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`pb-2 text-xs uppercase tracking-widest border-b-2 -mb-px transition-colors ${tab === key ? "border-black text-black font-medium" : "border-transparent text-neutral-400 hover:text-neutral-600"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "all" && (
        purchases.length === 0 ? (
          <EmptyState emoji="🚚" title="No purchases yet" hint={suppliers.length === 0 ? "Add a mill / supplier first, then your first purchase will feel right at home." : "Record your first purchase — date, supplier and rate is all it takes."} action={<button className="btn-primary" onClick={openAdd}>+ Add Purchase</button>} />
        ) : (
          <div className="space-y-6">
            {purchaseDateGroups.map((g) => (
              <div key={g.date}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-bold text-neutral-800">{fmtDate(g.date)}</span>
                  <span className="text-xs text-neutral-400">{g.rows.length} purchase{g.rows.length > 1 ? "s" : ""}</span>
                  <div className="flex-1 border-b border-neutral-200" />
                  <span className="text-sm font-semibold text-neutral-600 tabular-nums">{fmtMoney(g.dayTotal)}</span>
                </div>

                {/* Desktop rows */}
                <div className="hidden sm:block border border-neutral-200 bg-white">
                  <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_120px_140px_150px_120px] gap-3 px-4 py-2 text-[11px] uppercase tracking-widest text-neutral-500 font-medium border-b border-neutral-200">
                    <span>Product / Item</span>
                    <span>Mill / Supplier</span>
                    <span className="text-right">Quantity</span>
                    <span className="text-right">Buying Price</span>
                    <span className="text-right">Your Selling Price</span>
                    <span />
                  </div>
                  {g.rows.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_120px_140px_150px_120px] gap-3 px-4 py-3 border-b border-neutral-100 last:border-b-0 cursor-pointer hover:bg-neutral-50 transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-xs truncate">{r.item}</span>
                        <span className="block text-[11px] text-neutral-400 truncate">
                          {[r.product, r.spec, r.quality].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </span>
                      <span className="self-center text-neutral-600 text-xs truncate">{r.supplier}</span>
                      <span className="self-center text-right text-xs tabular-nums">{fmtQtyWithUnit(r.qty, r.unit)}</span>
                      <span className="self-center text-right text-xs tabular-nums">{fmtRateWithUnit(r.rate, r.unit)}</span>
                      <span className="self-center text-right text-xs tabular-nums">
                        {r.sellRate ? fmtRateWithUnit(r.sellRate, r.unit) : <span className="text-neutral-400">—</span>}
                      </span>
                      <span className="self-center text-right whitespace-nowrap">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); }} className="btn-ghost !py-1 !px-3 text-xs">
                          View
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(purchases.find((p) => p.id === r.id)!); }} className="btn-ghost !py-1 !px-3 text-xs text-red-600 hover:!bg-red-50">
                          Delete
                        </button>
                      </span>
                    </div>
                  ))}
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden border border-neutral-200 bg-white divide-y divide-neutral-100">
                  {g.rows.map((r) => (
                    <div key={r.id} onClick={() => setSelectedId(r.id)} className="p-3 cursor-pointer active:bg-neutral-50">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{r.item}</span>
                        <span className="shrink-0 font-medium text-sm tabular-nums">{fmtQtyWithUnit(r.qty, r.unit)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                        <span className="truncate">{([r.product, r.spec, r.quality].filter(Boolean).join(" · ") || "—")}</span>
                        <span className="shrink-0 text-neutral-400 truncate">{r.supplier}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1.5 text-xs">
                        <span className="tabular-nums text-neutral-600">Buy {fmtRateWithUnit(r.rate, r.unit)}</span>
                        <span className="tabular-nums font-medium">
                          {r.sellRate ? `Sell ${fmtRateWithUnit(r.sellRate, r.unit)}` : <span className="text-neutral-400">No sell price</span>}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "dues" && (
        <div>
          {totalDue > 0 && (
            <div className="border border-neutral-200 p-4 mb-5 flex justify-between items-center">
              <span className="text-xs uppercase tracking-widest text-neutral-500">Total Outstanding to Suppliers</span>
              <span className="font-bold tabular-nums text-lg">{fmtMoney(totalDue)}</span>
            </div>
          )}
          {duePurchases.length === 0 ? (
            <div className="border border-dashed border-neutral-300">
              <EmptyState emoji="🎉" compact title="No pending dues" hint="Every purchase is fully paid — the mills are smiling today." />
            </div>
          ) : (
            <div className="space-y-6">
              {dueDateGroups.map((g) => (
                <div key={g.date}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-bold text-neutral-800">{fmtDate(g.date)}</span>
                    <span className="text-xs text-neutral-400">{g.rows.length} due</span>
                    <div className="flex-1 border-b border-neutral-200" />
                    <span className="text-xs font-semibold text-white bg-[#a12b1f] px-2 py-0.5 rounded tabular-nums">Due {fmtMoney(g.dayTotal - g.dayPaid)}</span>
                  </div>
                  {/* Desktop rows */}
                  <div className="hidden sm:block border border-neutral-200 bg-white overflow-x-auto">
                    <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_130px_100px_110px_100px_150px] gap-3 px-4 py-2 text-[11px] uppercase tracking-widest text-neutral-500 font-medium border-b border-neutral-200 min-w-[820px]">
                      <span>Product / Item</span>
                      <span>Mill / Supplier</span>
                      <span className="text-right">Total Payable to Mill</span>
                      <span className="text-right">Paid</span>
                      <span className="text-right">Remaining</span>
                      <span>Last Payment</span>
                      <span />
                    </div>
                    {g.rows.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => { openPay(r.id); }}
                        className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_130px_100px_110px_100px_150px] gap-3 px-4 py-3 border-b border-neutral-100 last:border-b-0 cursor-pointer hover:bg-neutral-50 transition-colors min-w-[820px]"
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-xs truncate">{r.item}</span>
                          <span className="block text-[11px] text-neutral-400 truncate">
                            {[r.product, r.spec, r.quality].filter(Boolean).join(" · ") || "—"}
                          </span>
                        </span>
                        <span className="self-center text-neutral-600 text-xs truncate">{r.supplier}</span>
                        <span className="self-center text-right text-xs tabular-nums">{fmtMoney(r.totalPayable)}</span>
                        <span className="self-center text-right text-xs text-neutral-500 tabular-nums">{fmtMoney(r.paid)}</span>
                        <span className="self-center text-right font-medium text-xs text-[#a12b1f] tabular-nums">{fmtMoney(r.remaining)}</span>
                        <span className="self-center text-xs text-neutral-500">
                          {r.lastPaidAt ? fmtDate(r.lastPaidAt) : <span className="text-neutral-400">—</span>}
                        </span>
                        <span className="self-center text-right whitespace-nowrap">
                          <button onClick={(e) => { e.stopPropagation(); openPay(r.id); }} className="btn-primary !py-1 !px-3 text-xs">Pay</button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(purchases.find((p) => p.id === r.id)!); }} className="btn-ghost !py-1 !px-3 text-xs text-red-600 hover:!bg-red-50">Delete</button>
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden border border-neutral-200 bg-white divide-y divide-neutral-100">
                    {g.rows.map((r) => (
                      <div key={r.id} className="p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium text-sm truncate">{r.item}</span>
                          <span className="shrink-0 font-medium text-sm text-[#a12b1f] tabular-nums">Due {fmtMoney(r.remaining)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                          <span className="truncate">{([r.product, r.spec, r.quality].filter(Boolean).join(" · ") || "—")}</span>
                          <span className="shrink-0 text-neutral-400 truncate">{r.supplier}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1.5 text-xs text-neutral-500">
                          <span className="tabular-nums">Paid {fmtMoney(r.paid)} of {fmtMoney(r.totalPayable)}</span>
                          <span className="tabular-nums shrink-0">{r.lastPaidAt ? `Last ${fmtDate(r.lastPaidAt)}` : "No payments yet"}</span>
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                          <button onClick={() => { openPay(r.id); }} className="btn-primary !py-1 !px-3 text-xs">Pay</button>
                          <button onClick={() => setDeleteTarget(purchases.find((p) => p.id === r.id)!)} className="btn-ghost !py-1 !px-3 text-xs text-red-600 hover:!bg-red-50">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Purchase Modal */}
      <Modal open={open} onClose={() => { onClose(); setFormError(""); }} title="Add Purchase">
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div><label>Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
          <div><label>Supplier</label><select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label>Product</label><select value={form.productId} onChange={(e) => { const v = e.target.value; const firstItem = productItems.find((i) => i.productId === v)?.name ?? ""; setForm({ ...form, productId: v, item: firstItem, spec: "", quality: "" }); }}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label>Product Item</label><select value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} required><option value="" disabled>Select item…</option>{productItems.filter((i) => i.productId === form.productId).map((i) => <option key={i.id} value={i.name}>{i.name}</option>)}</select></div>
          {/* Cement and friends: factory/mill + quality as two fields */}
          {specLabel !== "Quality" ? (
            <>
              <div>
                <label>{specLabel}</label>
                <input
                  list="spec-options"
                  placeholder="Pick or type a factory…"
                  value={form.spec}
                  onChange={(e) => setForm({ ...form, spec: e.target.value })}
                />
                <datalist id="spec-options">
                  {qualities
                    .filter(
                      (q) =>
                        q.specOnly &&
                        (!q.productId || q.productId === form.productId)
                    )
                    .map((q) => (
                      <option key={q.id} value={q.name} />
                    ))}
                </datalist>
              </div>
              <div>
                <label>Quality</label>
                <input
                  list="quality-options"
                  placeholder="Pick or type a quality…"
                  value={form.quality}
                  onChange={(e) => setForm({ ...form, quality: e.target.value })}
                />
                <datalist id="quality-options">
                  {qualities
                    .filter(
                      (q) =>
                        !q.specOnly &&
                        (!q.productId || q.productId === form.productId)
                    )
                    .map((q) => (
                      <option key={q.id} value={q.name} />
                    ))}
                </datalist>
              </div>
            </>
          ) : (
            <div>
              <label>{specLabel}</label>
              <input
                list="quality-options"
                placeholder="Pick or type a quality…"
                value={form.quality}
                onChange={(e) => setForm({ ...form, quality: e.target.value })}
              />
              <datalist id="quality-options">
                {qualities
                  .filter(
                    (q) =>
                      !q.specOnly &&
                      (!q.productId || q.productId === form.productId)
                  )
                  .map((q) => (
                    <option key={q.id} value={q.name} />
                  ))}
              </datalist>
            </div>
          )}
          <div><label>Unit</label><input value={qtyUnitLabel(productUnit) || "—"} disabled className="!bg-neutral-50 !text-neutral-600" /></div>
          <div><label>Quantity ({qtyLabel})</label><input type="number" min="0.1" step="any" placeholder="0" value={numVal(form.qty)} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} required /></div>
          <div><label>Buying Price ({perLabel})</label><input type="number" min="0" placeholder="0" value={numVal(form.rate)} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} required /></div>
          <div><label>Transport Cost</label><input type="number" min="0" placeholder="0" value={numVal(form.transport)} onChange={(e) => setForm({ ...form, transport: Number(e.target.value) })} /></div>
          <div><label>Other Expenses</label><input type="number" min="0" placeholder="0" value={numVal(form.otherCost)} onChange={(e) => setForm({ ...form, otherCost: Number(e.target.value) })} /></div>
          <div className="col-span-2 grid grid-cols-2 gap-4">
            <div><label>Your Selling Price ({perLabel})</label><input type="number" min="0" placeholder="0" value={numVal(form.sellRate)} onChange={(e) => setForm({ ...form, sellRate: Number(e.target.value) })} /></div>
            <div><label>Paid Now (to supplier)</label><input type="number" min="0" placeholder="0" value={numVal(form.paidNow)} onChange={(e) => setForm({ ...form, paidNow: Number(e.target.value) })} /></div>
          </div>
          <div className="col-span-2 border border-dashed border-neutral-400 p-3 flex justify-between items-center">
            <div><span className="block text-xs uppercase tracking-widest text-neutral-500">Total Amount</span><span className="block text-xs text-neutral-400 mt-1">{form.qty || 0} {qtyLabel} × {fmtMoney(form.rate)}{perLabel}</span></div>
            <span className="font-medium tabular-nums text-right shrink-0">{fmtMoney(totalStock).replace("₨ ", "")}<span className="text-neutral-400 text-xs ml-1">₨</span></span>
          </div>
          {form.sellRate > 0 && (
            <div className="col-span-2 border border-dashed border-neutral-400 p-3 flex justify-between items-center">
              <div><span className="block text-xs uppercase tracking-widest text-neutral-500">Expected Profit ({perLabel})</span><span className="block text-xs text-neutral-400 mt-1">sell {fmtMoney(form.sellRate)}{perLabel} − cost {fmtMoney(landedPerUnit)}{perLabel}</span></div>
              <span className={`font-medium tabular-nums text-right shrink-0 ${marginPerUnit < 0 ? "text-red-600" : ""}`}>{marginPerUnit < 0 ? "− " : ""}{fmtMoney(Math.abs(marginPerUnit)).replace("₨ ", "")}<span className="text-neutral-400 text-xs ml-1">₨</span></span>
            </div>
          )}
          <div className="col-span-2 border border-dashed border-neutral-400 p-3 flex justify-between items-center">
            <div><span className="block text-xs uppercase tracking-widest text-neutral-500">Actual Cost ({perLabel})</span><span className="block text-xs text-neutral-400 mt-1">product + transport + expenses, per {qtyUnitLabel(productUnit) || "unit"}</span></div>
            <span className="font-medium tabular-nums text-right shrink-0">{fmtMoney(landedPerUnit).replace("₨ ", "")}<span className="text-neutral-400 text-xs ml-1">₨</span></span>
          </div>
          <div className="col-span-2 border border-dashed border-neutral-800 p-3 flex justify-between items-center bg-black text-white">
            <div><span className="block text-xs uppercase tracking-widest text-neutral-400">Remaining Due to Supplier</span><span className="block text-xs text-neutral-500 mt-1">total {fmtMoney(totalStock)} − paid {fmtMoney(Number(form.paidNow) || 0)}</span></div>
            <span className="font-medium tabular-nums text-right shrink-0">{fmtMoney(Math.max(0, totalStock - Number(form.paidNow || 0))).replace("₨ ", "")}<span className="text-neutral-500 text-xs ml-1">₨</span></span>
          </div>
          {formError && (
            <div className="col-span-2 border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">{formError}</div>
          )}
          <div className="col-span-2 flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={() => { onClose(); setFormError(""); }}>Cancel</button>
            <button type="submit" className="btn-primary">Save Purchase</button>
          </div>
        </form>
      </Modal>

      {/* Purchase Details Modal */}
      <Modal open={!!selected} onClose={() => setSelectedId(null)} title={selected ? `Purchase · ${selected.item}` : "Purchase Details"}>
        {selected && (() => {
          const total = purchaseTotal(selected);
          const costPerUnit = selected.qty > 0 ? total / selected.qty : 0;
          const transportShare = selected.qty > 0 ? selected.transport / selected.qty : 0;
          const otherShare = selected.qty > 0 ? selected.otherCost / selected.qty : 0;
          const avgSellPerUnit = inventory.find((r) => r.item === selected.item)?.avgSellRate ?? 0;
          const usedSell = selected.sellRate ?? avgSellPerUnit;
          const perUnit = perUnitLabel(selected.unit);
          const profitPerUnit = usedSell > 0 ? usedSell - costPerUnit : 0;
          const payable = steelAmount(selected);
          const paid = selected.paid ?? 0;
          const remaining = Math.max(0, payable - paid);
          const detailRows = [
            { label: "Purchase Date", value: fmtDate(selected.date) },
            { label: "Supplier", value: supplierName(selected.supplierId) },
            { label: "Product", value: selected.product || "—" },
            { label: "Product Item", value: selected.item },
            ...(selected.spec
              ? [{ label: specLabelOf(selected.product), value: selected.spec }]
              : []),
            { label: selected.spec ? "Quality" : specLabelOf(selected.product), value: selected.quality || "—" },
            { label: "Quantity", value: fmtQtyWithUnit(selected.qty, selected.unit) },
            { label: "Buying Price" + perUnit, value: fmtMoney(selected.rate) },
            { label: "+ Transport" + perUnit, value: selected.transport > 0 ? fmtMoney(transportShare) : "—", muted: true },
            { label: "+ Other Expenses" + perUnit, value: selected.otherCost > 0 ? fmtMoney(otherShare) : "—", muted: true },
            { label: "Landed Cost" + perUnit, value: fmtMoney(costPerUnit), strong: true },
            { label: "Transport (total)", value: fmtMoney(selected.transport), muted: true },
            { label: "Other Expenses (total)", value: fmtMoney(selected.otherCost), muted: true },
            { label: "Total Payable to Mill", value: fmtMoney(payable) },
            { label: "Already Paid", value: fmtMoney(paid), muted: true },
            { label: "Remaining Due", value: fmtMoney(remaining), strong: remaining > 0, muted: remaining === 0 },
            { label: "Your Selling Price", value: usedSell ? fmtRateWithUnit(usedSell, selected.unit) : "—" },
            { label: "Profit" + perUnit, value: fmtMoney(profitPerUnit), strong: true },
          ];
          return (
            <div>
              {detailRows.map((r) => (
                <div key={r.label} className={`flex justify-between items-center gap-4 px-4 py-3 border-b border-neutral-200 last:border-b-0 ${r.strong ? "bg-black text-white" : ""}`}>
                  <span className={`text-xs uppercase tracking-widest ${r.muted ? "text-neutral-400" : r.strong ? "" : "text-neutral-500"}`}>{r.label}</span>
                  <span className={`tabular-nums text-right shrink-0 ${r.muted ? "text-neutral-400" : "font-medium"}`}>{r.value}</span>
                </div>
              ))}
              <div className="flex justify-between items-center mt-4">
                <p className="text-xs text-neutral-500">Landed cost = buying price + transport + other expenses, spread per unit. Profit = Your Selling Price − Landed Cost.</p>
                <button onClick={() => setDeleteTarget(selected)} className="btn-ghost !py-1 !px-3 text-xs text-red-600 hover:!bg-red-50 shrink-0">Delete</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Delete Purchase Confirm Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeletePurchase}
        title="Delete this purchase?"
        confirmLabel="Delete Purchase"
      >
        {deleteTarget && (() => {
          const p = deleteTarget;
          const due = Math.max(0, steelAmount(p) - (p.paid ?? 0));
          const otherPurchases = purchases.some((x) => x.item === p.item && x.id !== p.id);
          const soldAny = sales.some((s) => s.lines.some((l) => l.item === p.item));
          const soldFrom = sales.reduce(
            (a, s) =>
              a +
              s.lines
                .filter((l) => l.purchaseId === p.id)
                .reduce((x, l) => x + l.qty, 0),
            0
          );
          const vanishes = !otherPurchases && !soldAny;
          return (
            <>
              <div className="border border-neutral-200 mb-5">
                <div className="flex justify-between items-center gap-3 py-2.5 px-4 border-b border-neutral-200">
                  <span className="text-sm text-neutral-500 truncate">{p.item}</span>
                  <span className="font-medium text-sm tabular-nums shrink-0">{fmtQtyWithUnit(p.qty, p.unit)}</span>
                </div>
                <div className="flex justify-between py-2 px-4 border-b border-neutral-200 text-xs">
                  <span className="text-neutral-500">Supplier</span>
                  <span className="tabular-nums">{supplierName(p.supplierId)}</span>
                </div>
                <div className="flex justify-between py-2 px-4 border-b border-neutral-200 text-xs">
                  <span className="text-neutral-500">Purchase date</span>
                  <span className="tabular-nums">{fmtDate(p.date)}</span>
                </div>
                {due > 0 && (
                  <div className="flex justify-between py-2 px-4 text-xs">
                    <span className="text-neutral-500">Unpaid to mill</span>
                    <span className="tabular-nums font-medium text-[#a12b1f]">{fmtMoney(due)}</span>
                  </div>
                )}
              </div>
              <div className="border border-red-200 bg-red-50 p-4">
                <p className="text-[11px] uppercase tracking-widest text-red-700 font-medium mb-2">Deleting changes your numbers</p>
                <ul className="text-xs text-neutral-700 space-y-1.5 list-disc pl-4">
                  <li>
                    <span className="font-medium text-neutral-900">Mill dues:</span>{" "}
                    {due > 0
                      ? `the unpaid ${fmtMoney(due)} to the mill is cleared, so the dues shown on your dashboard fall.`
                      : "this purchase was fully paid, so no due changes."}
                  </li>
                  <li>
                    <span className="font-medium text-neutral-900">Stock:</span>{" "}
                    the {fmtQtyWithUnit(p.qty, p.unit)} it added leaves inventory
                    {vanishes ? ` — nothing else references ${p.item}, so it disappears from the Inventory page` : ""}.
                  </li>
                  {soldFrom > 0 && (
                    <li>
                      <span className="font-medium text-neutral-900">Profit:</span>{" "}
                      {fmtQtyWithUnit(soldFrom, p.unit)} of it is already sold — those sales are re-costed from your other stock, so past profit figures shift.
                    </li>
                  )}
                  <li>
                    <span className="font-medium text-neutral-900">Records:</span> this purchase and its payment history are permanently removed.
                  </li>
                </ul>
                <p className="text-[11px] font-semibold text-red-700 mt-2.5">
                  Stock, mill dues, profit and reports all update across the app. This cannot be undone.
                </p>
              </div>
            </>
          );
        })()}
      </ConfirmModal>

      {/* Pay Due Modal */}
      <Modal open={!!payId} onClose={closePay} title="Pay Supplier">
        {(() => {
          const p = purchases.find((x) => x.id === payId);
          if (!p) return null;
          const total = steelAmount(p);
          const paid = p.paid ?? 0;
          const rem = Math.max(0, total - paid);
          const history = p.paymentHistory ?? (paid > 0 ? [{ date: p.date + "T00:00:00", amount: paid }] : []);
          return (
            <form noValidate onSubmit={(e) => { e.preventDefault(); const amt = Number(payAmount) || 0; if (amt <= 0) { setPayError("Enter the amount you're paying to the mill."); return; } if (amt > rem + 0.001) { setPayError(`You can't pay more than the remaining due of ${fmtMoney(rem)} — ${fmtMoney(total)} is payable and ${fmtMoney(paid)} is already paid.`); return; } setPayError(""); const today = new Date().toISOString().slice(0, 10); updatePurchase(p.id, { paid: paid + amt, lastPaidAt: today, lastPaidAmount: amt, paymentHistory: [...(p.paymentHistory ?? []), { date: new Date().toISOString(), amount: amt }] }); addPayment({ date: today, type: "supplier", partyId: p.supplierId, amount: amt, method: "Cash", note: `Payment on ${p.item} purchase` }); closePay(); }}>
              <div className="mb-4">
                <div className="flex justify-between py-2 border-b border-neutral-200 text-sm"><span className="text-neutral-500">{p.item} · {supplierName(p.supplierId)}</span><span className="tabular-nums">{fmtDate(p.date)}</span></div>
                <div className="flex justify-between py-2 border-b border-neutral-200 text-sm"><span className="text-neutral-500">Total Payable to Mill</span><span className="tabular-nums">{fmtMoney(total)}</span></div>
                <div className="flex justify-between py-2 border-b border-neutral-200 text-sm"><span className="text-neutral-500">Already Paid</span><span className="tabular-nums">{fmtMoney(paid)}</span></div>
                <div className="flex justify-between py-2 border-b border-neutral-200 text-sm"><span className="text-neutral-500">Remaining Due</span><span className="tabular-nums">{fmtMoney(rem)}</span></div>
              </div>
              {history.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Payment History</p>
                  {[...history].reverse().map((h, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b border-dashed border-neutral-200 last:border-b-0 text-sm">
                      <span className="text-neutral-500 tabular-nums">{fmtDateTime(h.date)}</span>
                      <span className="tabular-nums font-medium">{fmtMoney(h.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <label>Amount to Pay</label>
              <input type="number" min="0" max={rem} placeholder="0" value={numVal(payAmount)} onChange={(e) => { setPayAmount(Number(e.target.value)); setPayError(""); }} required />
              {payError && (
                <div className="border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2 mt-3">{payError}</div>
              )}
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" className="btn-ghost" onClick={closePay}>Cancel</button>
                <button type="submit" className="btn-primary">Record Payment</button>
              </div>
            </form>
          );
        })()}
      </Modal>
    </Page>
  );
}
