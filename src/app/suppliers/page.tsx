"use client";

import { useState, useMemo } from "react";
import { useStore, purchaseTotal, steelAmount } from "@/lib/store";
import { Page, PageTitle, Modal, ConfirmModal, useToggle, EmptyState } from "@/components/ui";
import { fmtMoney, fmtDate, fmtQtyWithUnit } from "@/lib/format";
import type { Purchase, Supplier } from "@/lib/types";

type DateGroup = {
  date: string;
  purchases: Purchase[];
  dayTotal: number;
  dayPaid: number;
};

export default function SuppliersPage() {
  const { suppliers, purchases, sales, products, addSupplier, deleteSupplier } = useStore();
  const { open, onOpen, onClose } = useToggle();
  const [form, setForm] = useState({ name: "", mill: "", phone: "" });

  const [searchInput, setSearchInput] = useState("");
  const [searchMode, setSearchMode] = useState<"name" | "phone">("name");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedMode, setAppliedMode] = useState<"name" | "phone">("name");

  const [viewSupplierId, setViewSupplierId] = useState<string | null>(null);
  const viewSupplier = suppliers.find((s) => s.id === viewSupplierId);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const confirmDeleteSupplier = () => {
    if (!deleteTarget) return;
    deleteSupplier(deleteTarget.id);
    if (viewSupplierId === deleteTarget.id) setViewSupplierId(null);
    setDeleteTarget(null);
  };

  const supplierDateGroups: DateGroup[] = useMemo(() => {
    if (!viewSupplierId) return [];
    const sp = purchases.filter((p) => p.supplierId === viewSupplierId).sort((a, b) => b.date.localeCompare(a.date));
    const map = new Map<string, Purchase[]>();
    for (const p of sp) {
      const list = map.get(p.date) ?? [];
      list.push(p);
      map.set(p.date, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({
        date,
        purchases: items,
        dayTotal: items.reduce((a, p) => a + purchaseTotal(p), 0),
        dayPaid: items.reduce((a, p) => a + (p.paid ?? 0), 0),
      }));
  }, [purchases, viewSupplierId]);

  /* what the secondary field means for a product — "Quality" by default,
     "Factory / Mill" when it is Cement */
  const specLabelOf = (productName?: string) => {
    const pr = products.find((x) => x.name === productName);
    const custom = pr?.specLabel ?? (productName?.toLowerCase().includes("cement") ? "Factory / Mill" : undefined);
    return custom ?? "Quality";
  };

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 11);
    return digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
  };

  const onSearchChange = (v: string) => {
    setSearchInput(searchMode === "phone" ? formatPhone(v) : v);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    addSupplier({ name: form.name.trim(), mill: form.mill.trim(), phone: form.phone.trim() });
    setForm({ name: "", mill: "", phone: "" });
    onClose();
  };

  const filteredSuppliers = useMemo(() => {
    const q = appliedSearch.toLowerCase().trim();
    return suppliers.filter((s) => {
      if (!q) return true;
      if (appliedMode === "name") {
        return s.name.toLowerCase().includes(q);
      } else {
        const phoneDigits = s.phone.replace(/\D/g, "");
        const queryDigits = q.replace(/\D/g, "");
        return phoneDigits.includes(queryDigits);
      }
    });
  }, [suppliers, appliedSearch, appliedMode]);

  return (
    <Page>
      <PageTitle
        title="Mills / Suppliers"
        sub="Purchases, payments and what you still owe"
        action={<button className="btn-primary" onClick={onOpen}>+ New Supplier</button>}
      />

      {suppliers.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="flex flex-1 sm:max-w-96">
            <select
              value={searchMode}
              onChange={(e) => setSearchMode(e.target.value as "name" | "phone")}
              className="!w-auto !rounded-r-none !border-r-0"
            >
              <option value="name">Name</option>
              <option value="phone">Phone</option>
            </select>
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={searchMode === "name" ? "Search by name..." : "Search by phone..."}
                value={searchInput}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setAppliedSearch(searchInput); setAppliedMode(searchMode); } }}
                className="!w-full !rounded-l-none !pl-9"
              />
            </div>
          </div>
          <button onClick={() => { setAppliedSearch(searchInput); setAppliedMode(searchMode); }} className="btn-primary !py-2 !px-4 text-xs whitespace-nowrap">
            Search
          </button>
          {(appliedSearch.trim() !== "" || appliedMode !== "name") && (
            <button onClick={() => { setSearchInput(""); setAppliedSearch(""); setSearchMode("name"); setAppliedMode("name"); }} className="btn-ghost !py-2 !px-4 text-xs whitespace-nowrap">
              Clear
            </button>
          )}
        </div>
      )}

      {suppliers.length === 0 ? (
        <EmptyState
          emoji="🏭"
          title="No mills / suppliers yet"
          hint="Add the mills and suppliers you buy stock from — track every load and what you owe them."
          action={<button className="btn-primary" onClick={onOpen}>+ New Supplier</button>}
        />
      ) : (
        <>
          {/* desktop / tablet */}
          <div className="hidden sm:block border border-neutral-200 bg-white overflow-x-auto">
            {/* header */}
            <div className="grid grid-cols-[1.5fr_1fr_1fr_190px] gap-4 px-5 py-2.5 text-[11px] uppercase tracking-widest text-neutral-500 font-medium border-b border-neutral-200">
              <span>Supplier</span>
              <span>Phone</span>
              <span>Mill / Address</span>
              <span />
            </div>
            {/* rows */}
            {filteredSuppliers.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[1.5fr_1fr_1fr_190px] gap-4 px-5 py-3.5 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 transition-colors items-center"
              >
                <span className="font-semibold text-xs text-neutral-900 truncate">{s.name}</span>
                <span className="text-xs text-neutral-600 tabular-nums">{s.phone || "—"}</span>
                <span className="text-xs text-neutral-500 truncate">{s.mill || "—"}</span>
                <span className="text-right whitespace-nowrap">
                  <button
                    onClick={() => setViewSupplierId(s.id)}
                    className="btn-primary !py-1.5 !px-4 text-xs"
                  >
                    View History
                  </button>
                  <button
                    onClick={() => setDeleteTarget(s)}
                    className="btn-ghost !py-1.5 !px-3 text-xs text-red-600 hover:!bg-red-50 ml-2"
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </div>

          {/* mobile cards */}
          <div className="sm:hidden border border-neutral-200 bg-white divide-y divide-neutral-100">
            {filteredSuppliers.map((s) => (
              <div key={s.id} className="p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-semibold text-[15px] text-neutral-900 truncate">{s.name}</span>
                    <span className="block text-xs text-neutral-500 mt-0.5 truncate">{s.mill || "—"}</span>
                  </span>
                  <span className="shrink-0 text-xs text-neutral-600 tabular-nums">{s.phone || "—"}</span>
                </div>
                <div className="flex justify-end mt-2.5">
                  <button
                    onClick={() => setViewSupplierId(s.id)}
                    className="btn-primary !py-1.5 !px-4 text-xs"
                  >
                    View History
                  </button>
                  <button
                    onClick={() => setDeleteTarget(s)}
                    className="btn-ghost !py-1.5 !px-3 text-xs text-red-600 hover:!bg-red-50 ml-2"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* New Supplier Modal */}
      <Modal open={open} onClose={onClose} title="New Supplier">
        <form onSubmit={save} className="grid gap-4">
          <div><label>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Malik Traders" required autoFocus /></div>
          <div><label>City</label><input value={form.mill} onChange={(e) => setForm({ ...form, mill: e.target.value })} placeholder="e.g. Lahore" /></div>
          <div><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. 0300 1234567" /></div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!form.name.trim()}>Add Supplier</button>
          </div>
        </form>
      </Modal>

      {/* View History Modal */}
      <Modal open={!!viewSupplierId} onClose={() => setViewSupplierId(null)} title={viewSupplier ? `History — ${viewSupplier.name}` : "History"} size="4xl">
        {viewSupplier && (
          <div className="max-h-[70vh] overflow-y-auto -mx-5 sm:-mx-7 px-5 sm:px-7">
            {/* Supplier Info */}
            <div className="bg-neutral-50 border border-neutral-200 p-4 mb-5">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {viewSupplier.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <span className="block font-bold text-base text-neutral-900">{viewSupplier.name}</span>
                  <span className="block text-[11px] text-neutral-400">{[viewSupplier.mill, viewSupplier.phone].filter(Boolean).join(" · ")}</span>
                </div>
              </div>
            </div>

            {/* Date-wise purchase history */}
            {supplierDateGroups.length === 0 ? (
              <div className="text-center py-12 text-neutral-400 text-sm">No purchases from this supplier yet.</div>
            ) : (
              <div className="space-y-5">
                {supplierDateGroups.map((g) => (
                  <div key={g.date}>
                    {/* Date header */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{fmtDate(g.date)}</span>
                      <span className="text-[10px] text-neutral-300">|</span>
                      <span className="text-[10px] text-neutral-400">{g.purchases.length} load{g.purchases.length > 1 ? "s" : ""}</span>
                    </div>

                    {/* Items — receipt style */}
                    <div className="space-y-3">
                      {g.purchases.map((p) => {
                        const paid = p.paid ?? 0;
                        const payable = steelAmount(p);
                        const due = Math.max(0, payable - paid);
                        return (
                          <div key={p.id} className="border border-neutral-200 bg-white px-4 py-3 space-y-1.5">
                            {/* Row: Item */}
                            <div className="flex items-baseline justify-between gap-4">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 shrink-0">Item</span>
                              <span className="text-[13px] font-bold text-neutral-800 text-right">
                                {p.product && <span className="text-neutral-400 font-normal">{p.product} — </span>}
                                {p.item}
                              </span>
                            </div>
                            {/* Row: Quality */}
                            {p.quality && (
                              <div className="flex items-baseline justify-between gap-4">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 shrink-0">{specLabelOf(p.product)}</span>
                                <span className="text-[13px] font-medium text-neutral-700 text-right">{p.quality}</span>
                              </div>
                            )}
                            {/* Row: Quantity */}
                            <div className="flex items-baseline justify-between gap-4">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 shrink-0">Quantity</span>
                              <span className="text-[13px] font-medium text-neutral-700 tabular-nums text-right">{fmtQtyWithUnit(p.qty, p.unit)}</span>
                            </div>
                            {/* Row: Unit Price */}
                            <div className="flex items-baseline justify-between gap-4">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 shrink-0">Unit Price</span>
                              <span className="text-[13px] font-medium text-neutral-700 tabular-nums text-right">{fmtMoney(p.rate)}/{p.unit || "unit"}</span>
                            </div>
                            {/* Row: Total */}
                            <div className="flex items-baseline justify-between gap-4 pt-2 border-t border-neutral-100">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 shrink-0">Total</span>
                              <span className="text-[14px] font-bold text-neutral-800 tabular-nums">{fmtMoney(payable)}</span>
                            </div>
                            {/* Row: Paid */}
                            <div className="flex items-baseline justify-between gap-4">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 shrink-0">Paid</span>
                              <span className="text-[13px] font-medium text-emerald-600 tabular-nums">{fmtMoney(paid)}</span>
                            </div>
                            {/* Row: Due — only show if > 0 */}
                            {due > 0 && (
                              <div className="flex items-baseline justify-between gap-4">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 shrink-0">Due</span>
                                <span className="text-[13px] font-bold text-[#a12b1f] tabular-nums">{fmtMoney(due)}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Supplier Confirm Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteSupplier}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : "Delete supplier?"}
        confirmLabel="Delete Supplier"
      >
        {deleteTarget && (() => {
          const t = deleteTarget;
          const pur = purchases.filter((p) => p.supplierId === t.id);
          const pIds = new Set(pur.map((p) => p.id));
          const inv = sales.filter((s) =>
            s.lines.some(
              (l) => l.supplierId === t.id || (l.purchaseId && pIds.has(l.purchaseId))
            )
          );
          const dues = pur.reduce((a, p) => a + Math.max(0, steelAmount(p) - (p.paid ?? 0)), 0);
          return (
            <>
              <div className="border border-neutral-200 mb-5">
                <div className="flex justify-between items-center gap-3 py-2.5 px-4 border-b border-neutral-200">
                  <span className="text-sm font-medium truncate">{t.name}</span>
                  <span className="text-xs text-neutral-400 shrink-0 tabular-nums">{t.phone || "—"}</span>
                </div>
                <div className="flex justify-between py-2 px-4 border-b border-neutral-200 text-xs">
                  <span className="text-neutral-500">Mill / Address</span>
                  <span className="tabular-nums">{t.mill || "—"}</span>
                </div>
                <div className="flex justify-between py-2 px-4 border-b border-neutral-200 text-xs">
                  <span className="text-neutral-500">Purchases from them</span>
                  <span className="tabular-nums">{pur.length}</span>
                </div>
                <div className="flex justify-between py-2 px-4 border-b border-neutral-200 text-xs">
                  <span className="text-neutral-500">Sales using their stock</span>
                  <span className="tabular-nums">{inv.length}</span>
                </div>
                {dues > 0 && (
                  <div className="flex justify-between py-2 px-4 text-xs">
                    <span className="text-neutral-500">You owe them</span>
                    <span className="tabular-nums font-medium text-[#a12b1f]">{fmtMoney(dues)}</span>
                  </div>
                )}
              </div>
              <div className="border border-red-200 bg-red-50 p-4">
                <p className="text-[11px] uppercase tracking-widest text-red-700 font-medium mb-2">Deleting changes your numbers</p>
                <ul className="text-xs text-neutral-700 space-y-1.5 list-disc pl-4">
                  <li>
                    <span className="font-medium text-neutral-900">Mill dues:</span>{" "}
                    {dues > 0
                      ? `the unpaid ${fmtMoney(dues)} is cleared, so Mills Payment Dues on the dashboard falls.`
                      : "this mill is fully paid up, so no due changes."}
                  </li>
                  <li>
                    <span className="font-medium text-neutral-900">Stock:</span>{" "}
                    {pur.length > 0
                      ? `${pur.length} purchase load${pur.length === 1 ? "" : "s"} are removed, and the stock they added leaves Inventory.`
                      : "no purchases are on record, so stock is unchanged."}
                  </li>
                  {inv.length > 0 && (
                    <li>
                      <span className="font-medium text-neutral-900">Sales & profit:</span>{" "}
                      {inv.length} invoice{inv.length === 1 ? "" : "s"} sold from this mill&apos;s stock are removed — their revenue, dues and profit drop from Sales, Dashboard and Reports.
                    </li>
                  )}
                  <li>
                    <span className="font-medium text-neutral-900">Records:</span> payments made to this mill are removed too.
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
    </Page>
  );
}
