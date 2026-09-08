"use client";

import { useState, useMemo } from "react";
import { useStore, saleGrandTotal } from "@/lib/store";
import { Page, PageTitle, Modal, ConfirmModal, useToggle, EmptyState } from "@/components/ui";
import ReceivePaymentModal from "@/components/ReceivePaymentModal";
import { fmtMoney, fmtDate, fmtQtyWithUnit } from "@/lib/format";
import type { Sale } from "@/lib/types";

type DateGroup = {
  date: string;
  sales: Sale[];
  dayTotal: number;
  dayPaid: number;
};

export default function CustomersPage() {
  const { customers, sales, salePaid, addCustomer, deleteCustomer } = useStore();
  const [paySaleId, setPaySaleId] = useState<string | null>(null);
  const { open, onOpen, onClose } = useToggle();
  const [form, setForm] = useState({ name: "", shop: "", phone: "" });

  const [searchInput, setSearchInput] = useState("");
  const [searchMode, setSearchMode] = useState<"name" | "phone">("name");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedMode, setAppliedMode] = useState<"name" | "phone">("name");

  const [viewCustomerId, setViewCustomerId] = useState<string | null>(null);
  const viewCustomer = customers.find((c) => c.id === viewCustomerId);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; shop: string; phone: string } | null>(null);

  const confirmDeleteCustomer = () => {
    if (!deleteTarget) return;
    deleteCustomer(deleteTarget.id);
    if (viewCustomerId === deleteTarget.id) setViewCustomerId(null);
    setDeleteTarget(null);
  };

  const customerDateGroups: DateGroup[] = useMemo(() => {
    if (!viewCustomerId) return [];
    const cs = sales.filter((s) => s.customerId === viewCustomerId).sort((a, b) => b.date.localeCompare(a.date));
    const map = new Map<string, Sale[]>();
    for (const s of cs) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({
        date,
        sales: items,
        dayTotal: items.reduce((a, s) => a + saleGrandTotal(s), 0),
        dayPaid: items.reduce((a, s) => a + salePaid(s.id), 0),
      }));
  }, [sales, viewCustomerId, salePaid]);

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
    addCustomer({ name: form.name.trim(), shop: form.shop.trim(), phone: form.phone.trim() });
    setForm({ name: "", shop: "", phone: "" });
    onClose();
  };

  const rows = useMemo(() => {
    const q = appliedSearch.toLowerCase().trim();
    return customers
      .filter((c) => {
        if (!q) return true;
        if (appliedMode === "name") {
          return c.name.toLowerCase().includes(q);
        } else {
          const phoneDigits = c.phone.replace(/\D/g, "");
          const queryDigits = q.replace(/\D/g, "");
          return phoneDigits.includes(queryDigits);
        }
      })
      .map((c) => ({
        id: c.id,
        name: c.name,
        shop: c.shop,
        phone: c.phone,
      }));
  }, [customers, appliedSearch, appliedMode]);

  return (
    <Page>
      <PageTitle
        title="Customers"
        sub="Balances and payment history for every customer"
        action={<button className="btn-primary" onClick={onOpen}>+ New Customer</button>}
      />

      {customers.length > 0 && (
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
          {appliedSearch.trim() !== "" && (
            <button onClick={() => { setSearchInput(""); setAppliedSearch(""); setSearchMode("name"); setAppliedMode("name"); }} className="btn-ghost !py-2 !px-4 text-xs whitespace-nowrap">
              Clear
            </button>
          )}
        </div>
      )}

      {customers.length === 0 ? (
        <EmptyState
          emoji="🤝"
          title="No customers yet"
          hint="Add the shops you sell to — their balances and ledgers will live here."
          action={<button className="btn-primary" onClick={onOpen}>+ New Customer</button>}
        />
      ) : (
        <>
          {/* desktop / tablet */}
          <div className="hidden sm:block border border-neutral-200 bg-white overflow-x-auto">
            {/* header */}
            <div className="grid grid-cols-[1.5fr_1fr_1fr_190px] gap-4 px-5 py-2.5 text-[11px] uppercase tracking-widest text-neutral-500 font-medium border-b border-neutral-200">
              <span>Customer</span>
              <span>Shop / Area</span>
              <span>Phone</span>
              <span />
            </div>
            {/* rows */}
            {rows.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[1.5fr_1fr_1fr_190px] gap-4 px-5 py-3.5 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 transition-colors items-center"
              >
                <span className="font-semibold text-xs text-neutral-900 truncate">{c.name}</span>
                <span className="text-xs text-neutral-500 truncate">{c.shop || "—"}</span>
                <span className="text-xs text-neutral-600 tabular-nums">{c.phone || "—"}</span>
                <span className="text-right whitespace-nowrap">
                  <button
                    onClick={() => setViewCustomerId(c.id)}
                    className="btn-primary !py-1.5 !px-4 text-xs"
                  >
                    View History
                  </button>
                  <button
                    onClick={() => setDeleteTarget(c)}
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
            {rows.map((c) => (
              <div key={c.id} className="p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-semibold text-[15px] text-neutral-900 truncate">{c.name}</span>
                    <span className="block text-xs text-neutral-500 mt-0.5 truncate">{c.shop || "—"}</span>
                  </span>
                  <span className="shrink-0 text-xs text-neutral-600 tabular-nums">{c.phone || "—"}</span>
                </div>
                <div className="flex justify-end mt-2.5">
                  <button
                    onClick={() => setViewCustomerId(c.id)}
                    className="btn-primary !py-1.5 !px-4 text-xs"
                  >
                    View History
                  </button>
                  <button
                    onClick={() => setDeleteTarget(c)}
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

      {/* View History Modal */}
      <Modal open={!!viewCustomerId} onClose={() => setViewCustomerId(null)} title={viewCustomer ? `History — ${viewCustomer.name}` : "History"} size="4xl">
        {viewCustomer && (
          <div className="max-h-[70vh] overflow-y-auto -mx-5 sm:-mx-7 px-5 sm:px-7">
            {/* Customer Info */}
            <div className="bg-neutral-50 border border-neutral-200 p-4 mb-5">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {viewCustomer.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <span className="block font-bold text-base text-neutral-900">{viewCustomer.name}</span>
                  <span className="block text-[11px] text-neutral-400">{[viewCustomer.shop, viewCustomer.phone].filter(Boolean).join(" · ")}</span>
                </div>
              </div>
            </div>

            {/* Date-wise sales history */}
            {customerDateGroups.length === 0 ? (
              <div className="text-center py-12 text-neutral-400 text-sm">No sales to this customer yet.</div>
            ) : (
              <div className="space-y-5">
                {customerDateGroups.map((g) => (
                  <div key={g.date}>
                    {/* Date header */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{fmtDate(g.date)}</span>
                      <span className="text-[10px] text-neutral-300">|</span>
                      <span className="text-[10px] text-neutral-400">{g.sales.length} invoice{g.sales.length > 1 ? "s" : ""}</span>
                    </div>

                    {/* Invoices — receipt style */}
                    <div className="space-y-3">
                      {g.sales.map((s) => {
                        const total = saleGrandTotal(s);
                        const paid = salePaid(s.id);
                        const due = Math.max(0, total - paid);
                        return (
                          <div key={s.id} className="border border-neutral-200 bg-white px-4 py-3 space-y-1.5">
                            {/* Row: Invoice */}
                            <div className="flex items-baseline justify-between gap-4">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 shrink-0">Invoice</span>
                              <span className="text-[13px] font-bold text-neutral-800 text-right">{s.invoiceNo}</span>
                            </div>
                            {/* Row: Items */}
                            {s.lines.map((l, i) => (
                              <div key={i} className="flex items-baseline justify-between gap-4">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 shrink-0">{i === 0 ? "Items" : ""}</span>
                                <span className="text-[12px] text-neutral-700 text-right">
                                  {l.item} — {fmtQtyWithUnit(l.qty, l.unit)} × {fmtMoney(l.rate)}
                                </span>
                              </div>
                            ))}
                            {/* Row: Total */}
                            <div className="flex items-baseline justify-between gap-4 pt-2 border-t border-neutral-100">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 shrink-0">Total</span>
                              <span className="text-[14px] font-bold text-neutral-800 tabular-nums">{fmtMoney(total)}</span>
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

      <Modal open={open} onClose={onClose} title="New Customer">
        <form onSubmit={save} className="grid gap-4">
          <div><label>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ahmed Steel Mart" required autoFocus /></div>
          <div><label>Shop / Area</label><input value={form.shop} onChange={(e) => setForm({ ...form, shop: e.target.value })} placeholder="e.g. Bilal Gunj, Lahore" /></div>
          <div><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. 0300 1234567" /></div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!form.name.trim()}>Add Customer</button>
          </div>
        </form>
      </Modal>

      {/* Delete Customer Confirm Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteCustomer}
        title="Delete this customer?"
        confirmLabel="Delete Customer"
      >
        {deleteTarget && (() => {
          const t = deleteTarget;
          const inv = sales.filter((s) => s.customerId === t.id);
          const total = inv.reduce((a, s) => a + saleGrandTotal(s), 0);
          const paid = inv.reduce((a, s) => a + salePaid(s.id), 0);
          const due = Math.max(0, total - paid);
          return (
            <>
              <div className="border border-neutral-200 mb-5">
                <div className="flex justify-between items-center gap-3 py-2.5 px-4 border-b border-neutral-200">
                  <span className="text-sm font-medium truncate">{t.name}</span>
                  <span className="text-xs text-neutral-400 shrink-0 tabular-nums">{t.phone || "—"}</span>
                </div>
                <div className="flex justify-between py-2 px-4 border-b border-neutral-200 text-xs">
                  <span className="text-neutral-500">Shop / Area</span>
                  <span className="tabular-nums">{t.shop || "—"}</span>
                </div>
                <div className="flex justify-between py-2 px-4 border-b border-neutral-200 text-xs">
                  <span className="text-neutral-500">Invoices on record</span>
                  <span className="tabular-nums">{inv.length}</span>
                </div>
                {due > 0 && (
                  <div className="flex justify-between py-2 px-4 text-xs">
                    <span className="text-neutral-500">They owe you</span>
                    <span className="tabular-nums font-medium text-[#a12b1f]">{fmtMoney(due)}</span>
                  </div>
                )}
              </div>
              <div className="border border-red-200 bg-red-50 p-4">
                <p className="text-[11px] uppercase tracking-widest text-red-700 font-medium mb-2">Deleting changes your numbers</p>
                <ul className="text-xs text-neutral-700 space-y-1.5 list-disc pl-4">
                  <li>
                    <span className="font-medium text-neutral-900">Customer dues:</span>{" "}
                    {due > 0
                      ? `their unpaid ${fmtMoney(due)} is cleared, so Customer Payment Dues on the dashboard falls.`
                      : "they have paid everything, so no due changes."}
                  </li>
                  <li>
                    <span className="font-medium text-neutral-900">Sales & records:</span>{" "}
                    {inv.length} invoice{inv.length === 1 ? "" : "s"} and their payments are removed.
                  </li>
                  <li>
                    <span className="font-medium text-neutral-900">Stock:</span> sold goods return to Inventory, so those stock rows grow again.
                  </li>
                  <li>
                    <span className="font-medium text-neutral-900">Profit:</span> that revenue and its profit leave Sales, Dashboard and Reports.
                  </li>
                </ul>
                <p className="text-[11px] font-semibold text-red-700 mt-2.5">
                  Dues, stock, profit and reports all update across the app. This cannot be undone.
                </p>
              </div>
            </>
          );
        })()}
      </ConfirmModal>

      <ReceivePaymentModal saleId={paySaleId} onClose={() => setPaySaleId(null)} />
    </Page>
  );
}
