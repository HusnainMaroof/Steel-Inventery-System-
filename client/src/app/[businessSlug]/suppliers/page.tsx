"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useStore, purchaseTotal, steelAmount } from "@/lib/store";
import {
  groupPurchasesByParent,
  purchaseDocumentTotals,
  purchaseTotals,
} from "@/lib/purchase-utils";
import { BusyButton, ConfirmModal, CustomSelect, EmptyState, Modal, Page, PageTitle, RowActionsMenu, SearchBar, useToggle } from "@/components/ui";
import { fmtMoney, fmtDate, fmtQtyWithUnit } from "@/lib/format";
import { attrsValuesLine } from "@/lib/catalogue";
import { userFacingError } from "@/lib/user-error";
import type { Purchase, Supplier } from "@/lib/types";
import { Search } from "lucide-react";
import Decimal from "decimal.js";
import { toDecimal } from "../../../lib/decimal";

type DateGroup = {
  date: string;
  purchases: Purchase[];
  dayTotal: number;
  dayPaid: number;
};

export default function SuppliersPage() {
  const { suppliers, purchases, sales, products, attributeDefs, addSupplier, deleteSupplier, isPending, payments } = useStore();
  const activeSuppliers = suppliers.filter((supplier) => supplier.active !== false);
  const { open, onOpen, onClose } = useToggle();
  const [form, setForm] = useState({ name: "", mill: "", phone: "" });

  const [searchMode, setSearchMode] = useState<"name" | "phone">("name");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedMode, setAppliedMode] = useState<"name" | "phone">("name");

  const [viewSupplierId, setViewSupplierId] = useState<string | null>(null);
  const viewSupplier = suppliers.find((s) => s.id === viewSupplierId);
  const viewSupplierName =
    viewSupplier?.name ??
    payments.find((p) => p.type === "supplier" && p.partyId === viewSupplierId)?.partyName ??
    "Supplier";

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("view");
    if (id) setViewSupplierId(id);
  }, []);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDeleteSupplier = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteSupplier(deleteTarget.id);
      if (viewSupplierId === deleteTarget.id) setViewSupplierId(null);
      setDeleteTarget(null);
    } catch (reason) {
      setDeleteError(userFacingError(reason, "Could not delete this supplier."));
    }
  };

  const parentFirstLineIds = useMemo(() => {
    const ids = new Set<string>();
    for (const lines of groupPurchasesByParent(purchases).values()) {
      ids.add(lines[0]!.id);
    }
    return ids;
  }, [purchases]);

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
        dayTotal: items.reduce((a, p) => a.plus(toDecimal(purchaseTotal(p))), new Decimal(0)).toNumber(),
        dayPaid: items.reduce((a, p) => a.plus(toDecimal((p.paid ?? 0))), new Decimal(0)).toNumber(),
      }));
  }, [purchases, viewSupplierId]);

  /* what the secondary field means for a product — "Quality" by default,
     "Factory / Mill" when it is Cement */
  const specLabelOf = (productName?: string) => {
    const pr = products.find((x) => x.name === productName);
    return pr?.specLabel ?? "Details";
  };
  const attrLineOf = (p: { categoryId?: string; attributeSnapshot?: Record<string, string>; spec?: string; quality?: string }) =>
    p.attributeSnapshot
      ? attrsValuesLine(
          p.categoryId
            ? attributeDefs.filter((d) => d.categoryId === p.categoryId && d.active).sort((a, b) => a.sortOrder - b.sortOrder)
            : [],
          p.attributeSnapshot
        )
      : [p.spec, p.quality].filter(Boolean).join(" · ");

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 11);
    return digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
  };


  const [savingSupplier, setSavingSupplier] = useState(false);
  const savingSupplierRef = useRef(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingSupplierRef.current || !form.name.trim() || isPending("supplier:create")) return;
    savingSupplierRef.current = true;
    setSavingSupplier(true);
    setSupplierError(null);
    try {
      await addSupplier({ name: form.name.trim(), mill: form.mill.trim(), phone: form.phone.trim() });
      setForm({ name: "", mill: "", phone: "" });
      onClose();
    } catch (reason) {
      setSupplierError(userFacingError(reason, "Could not save this supplier."));
    } finally {
      savingSupplierRef.current = false;
      setSavingSupplier(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    const q = appliedSearch.toLowerCase().trim();
    return activeSuppliers.filter((s) => {
      if (!q) return true;
      if (appliedMode === "name") {
        return s.name.toLowerCase().includes(q);
      } else {
        const phoneDigits = s.phone.replace(/\D/g, "");
        const queryDigits = q.replace(/\D/g, "");
        return phoneDigits.includes(queryDigits);
      }
    });
  }, [activeSuppliers, appliedSearch, appliedMode]);

  return (
    <Page>
      <PageTitle
        title="Mills / Suppliers"
        action={<button className="btn-primary" onClick={onOpen}>+ New Supplier</button>}
      />

      {activeSuppliers.length > 0 && (
        <div className="mb-6 flex flex-col gap-2.5 rounded-2xl border border-[#E5E5E5] bg-white p-2 sm:flex-row sm:flex-wrap sm:items-center">
          <CustomSelect
            value={searchMode}
            onChange={(v) => setSearchMode(v as "name" | "phone")}
            options={[{ value: "name", label: "Name" }, { value: "phone", label: "Phone" }]}
            ariaLabel="Search by"
            compact
            className="w-full sm:w-40 shrink-0"
          />
          <SearchBar
            value={appliedSearch}
            onSearch={(q) => {
              setAppliedSearch(q);
              setAppliedMode(searchMode);
            }}
            format={searchMode === "phone" ? formatPhone : undefined}
            placeholder={searchMode === "name" ? "Search by name" : "Search by phone"}
            className="min-w-[240px] flex-1"
          />
        </div>
      )}

      {activeSuppliers.length === 0 ? (
        <EmptyState
          icon={<Search className="w-6 h-6 text-[#171717]/70" />}
          title="No mills / suppliers yet"
          hint="Add the mills and suppliers you buy stock from — track every load and what you owe them."
          action={<button className="btn-primary" onClick={onOpen}>+ New Supplier</button>}
        />
      ) : (
        <div className="space-y-8">
          <div className="md:overflow-hidden md:rounded-2xl md:border md:border-[#E5E5E5] md:bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white border-b border-[#E5E5E5]">
                  <th className="text-[13px] font-semibold normal-case tracking-normal text-[#171717] text-left py-3 px-4">Supplier</th>
                  <th className="text-[13px] font-semibold normal-case tracking-normal text-[#171717] text-left py-3 px-4">Phone</th>
                  <th className="text-[13px] font-semibold normal-case tracking-normal text-[#171717] text-left py-3 px-4">Mill / Address</th>
                  <th className="text-[13px] font-semibold normal-case tracking-normal text-[#171717] text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {filteredSuppliers.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer hover:bg-[#FBFBFA] transition-colors"
                    onClick={() => setViewSupplierId(s.id)}
                  >
                    <td className="py-3 px-4">
                      <span className="font-semibold text-[#171717] truncate block text-sm">{s.name}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[#171717]/70 tabular-nums text-sm">{s.phone || "-"}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[#171717]/70 truncate block text-sm">{s.mill || "-"}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu
                          items={[
                            { label: "View history", onClick: () => setViewSupplierId(s.id) },
                            { label: "Delete", onClick: () => setDeleteTarget(s), danger: true },
                          ]}
                          ariaLabel={`Actions for ${s.name}`}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {filteredSuppliers.map((s) => (
              <div
                key={s.id}
                onClick={() => setViewSupplierId(s.id)}
                className="cursor-pointer rounded-2xl border border-[#E5E5E5] bg-white p-4 active:bg-[#FBFBFA]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block font-semibold text-sm text-[#171717] truncate">{s.name}</span>
                    <span className="block text-[13px] text-[#171717]/70 truncate">{s.mill || "-"}</span>
                  </div>
                  <span onClick={(e) => e.stopPropagation()}>
                    <RowActionsMenu
                      items={[
                        { label: "View history", onClick: () => setViewSupplierId(s.id) },
                        { label: "Delete", onClick: () => setDeleteTarget(s), danger: true },
                      ]}
                      ariaLabel={`Actions for ${s.name}`}
                    />
                  </span>
                </div>
                <div className="mt-2 text-right">
                  <span className="text-[13px] text-[#171717]/70 tabular-nums">{s.phone || "-"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* New Supplier Modal */}
      <Modal open={open} onClose={onClose} title="New Supplier">
        {supplierError && (
          <div role="alert" className="text-[13px] font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3.5 py-2.5 mb-5">
            {supplierError}
          </div>
        )}
        <form onSubmit={save} className="grid gap-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-[#171717]/60">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Malik Traders" required autoFocus className="mt-1" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-[#171717]/60">City</label>
            <input value={form.mill} onChange={(e) => setForm({ ...form, mill: e.target.value })} placeholder="e.g. Lahore" className="mt-1" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-[#171717]/60">Phone</label>
            <input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. 0300 1234567" className="mt-1" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={savingSupplier || isPending("supplier:create")}>Cancel</button>
            <BusyButton type="submit" loading={savingSupplier || isPending("supplier:create")} disabled={!form.name.trim()}>
              Add Supplier
            </BusyButton>
          </div>
        </form>
      </Modal>

      {/* View History Modal */}
      <Modal open={!!viewSupplierId} onClose={() => setViewSupplierId(null)} title={`History — ${viewSupplierName}`} size="4xl">
        {viewSupplierId && (
          <div className="max-h-[70vh] overflow-y-auto">
            {/* Supplier Info */}
            <div className="bg-[#F8F8F7] border border-[#E5E5E5] rounded-xl p-5 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-ink flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {viewSupplierName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <span className="block font-bold text-[#171717]">{viewSupplierName}</span>
                  <span className="block text-[13px] text-[#171717]/70">{viewSupplier ? [viewSupplier.mill, viewSupplier.phone].filter(Boolean).join(" · ") : "Not in active supplier list"}</span>
                </div>
              </div>
            </div>

            {/* Date-wise purchase history */}
            {supplierDateGroups.length === 0 ? (
              <div className="text-center py-12 text-[#171717]/70 text-sm">No purchases from this supplier yet.</div>
            ) : (
              <div className="space-y-6">
                {supplierDateGroups.map((g) => (
                  <div key={g.date}>
                    {/* Date header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[15px] font-bold text-[#171717]">{fmtDate(g.date)}</span>
                      <span className="text-[13px] text-[#171717]/70 tabular-nums">{g.purchases.length} load{g.purchases.length > 1 ? "s" : ""}</span>
                      <span className="text-[13px] text-[#171717]/70">·</span>
                      <span className="text-[13px] text-[#171717]/70 tabular-nums">{fmtMoney(g.dayTotal)}</span>
                      {g.dayPaid > 0 && (
                        <>
                          <span className="text-[13px] text-[#171717]/70">·</span>
                          <span className="text-[13px] text-success tabular-nums">{fmtMoney(g.dayPaid)} paid</span>
                        </>
                      )}
                    </div>
                    <div className="h-px bg-[#E5E5E5] mb-4" />

                    {/* Items — receipt style */}
                    <div className="space-y-3">
                      {g.purchases.map((p) => {
                        const doc = purchaseTotals(p, purchases);
                        const paid = doc.paid;
                        const payable = steelAmount(p);
                        const due = doc.remaining;
                        return (
                          <div key={p.id} className="border border-[#E5E5E5] bg-white px-4 py-3 space-y-1.5">
                            {/* Row: Item */}
                            <div className="flex items-baseline justify-between gap-4">
                              <span className="text-[13px] font-semibold text-[#171717]">Item</span>
                              <span className="text-sm font-medium text-[#171717] text-right">
                                {p.product && <span className="text-[#171717]/70">{p.product} — </span>}
                                {p.item}
                              </span>
                            </div>
                            {/* Row: Attributes (dynamic) */}
                            {(() => {
                              const attrLine = attrLineOf(p);
                              return attrLine ? (
                                <div className="flex items-baseline justify-between gap-4">
                                  <span className="text-[13px] text-[#171717]/70">{p.attributeSnapshot ? "Attributes" : specLabelOf(p.product)}</span>
                                  <span className="text-[13px] text-[#171717]/70 text-right">{attrLine}</span>
                                </div>
                              ) : null;
                            })()}
                            {/* Row: Quantity */}
                            <div className="flex items-baseline justify-between gap-4">
                              <span className="text-[13px] text-[#171717]/70">Quantity</span>
                              <span className="text-[13px] text-[#171717]/70 tabular-nums text-right">{fmtQtyWithUnit(p.qty, p.unit)}</span>
                            </div>
                            {/* Row: Unit Price */}
                            <div className="flex items-baseline justify-between gap-4">
                              <span className="text-[13px] text-[#171717]/70">Unit Price</span>
                              <span className="text-[13px] text-[#171717]/70 tabular-nums text-right">{fmtMoney(p.rate)}/{p.unit || "unit"}</span>
                            </div>
                            {/* Row: Total */}
                            <div className="flex items-baseline justify-between gap-4 pt-2 border-t border-[#E5E5E5]">
                              <span className="text-[13px] font-semibold text-[#171717]">Total</span>
                              <span className="text-[14px] font-bold text-[#171717] tabular-nums">{fmtMoney(payable)}</span>
                            </div>
                            {parentFirstLineIds.has(p.id) && (
                              <>
                                <div className="flex items-baseline justify-between gap-4">
                                  <span className="text-[13px] text-[#171717]/70">Paid</span>
                                  <span className="text-[13px] text-success tabular-nums">{fmtMoney(paid)}</span>
                                </div>
                                {due > 0 && (
                                  <div className="flex items-baseline justify-between gap-4">
                                    <span className="text-[13px] text-[#171717]/70">Due</span>
                                    <span className="text-[13px] font-bold text-destructive tabular-nums">{fmtMoney(due)}</span>
                                  </div>
                                )}
                              </>
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
        onClose={() => { setDeleteTarget(null); setDeleteError(null); }}
        onConfirm={confirmDeleteSupplier}
        error={deleteError}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : "Delete supplier?"}
        loading={deleteTarget ? isPending(`supplier:delete:${deleteTarget.id}`) : false}
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
          const dues = [...groupPurchasesByParent(pur).values()].reduce(
            (a, lines) => a + purchaseDocumentTotals(lines).remaining,
            0,
          );
          return (
            <>
              <div className="border border-[#E5E5E5] mb-6">
                <div className="flex justify-between items-center gap-3 py-2.5 px-4 border-b border-[#E5E5E5]">
                  <span className="text-sm font-medium truncate">{t.name}</span>
                  <span className="text-xs text-[#171717]/70 shrink-0 tabular-nums">{t.phone || "-"}</span>
                </div>
                <div className="flex justify-between py-2 px-4 border-b border-[#E5E5E5] text-xs">
                  <span className="text-[#171717]/70">Mill / Address</span>
                  <span className="tabular-nums">{t.mill || "-"}</span>
                </div>
                <div className="flex justify-between py-2 px-4 border-b border-[#E5E5E5] text-xs">
                  <span className="text-[#171717]/70">Purchases from them</span>
                  <span className="tabular-nums">{pur.length}</span>
                </div>
                <div className="flex justify-between py-2 px-4 border-b border-[#E5E5E5] text-xs">
                  <span className="text-[#171717]/70">Sales using their stock</span>
                  <span className="tabular-nums">{inv.length}</span>
                </div>
                {dues > 0 && (
                  <div className="flex justify-between py-2 px-4 text-xs">
                    <span className="text-[#171717]/70">You owe them</span>
                    <span className="tabular-nums font-medium text-destructive">{fmtMoney(dues)}</span>
                  </div>
                )}
              </div>
              <div className="border border-destructive/20 bg-destructive/10 p-4 rounded-lg">
                <p className="text-xs uppercase tracking-widest text-destructive font-medium mb-2">Deleting changes your numbers</p>
                <ul className="text-xs text-[#171717]/70 space-y-1.5 list-disc pl-4">
                  <li>
                    <span className="font-medium text-[#171717]">Mill dues:</span>{" "}
                    {dues > 0
                      ? `the unpaid ${fmtMoney(dues)} is cleared, so Mills Payment Dues on the dashboard falls.`
                      : "this mill is fully paid up, so no due changes."}
                  </li>
                  <li>
                    <span className="font-medium text-[#171717]">Stock:</span>{" "}
                    {pur.length > 0
                      ? `${pur.length} purchase load${pur.length === 1 ? "" : "s"} are removed, and the stock they added leaves Inventory.`
                      : "no purchases are on record, so stock is unchanged."}
                  </li>
                  {inv.length > 0 && (
                    <li>
                      <span className="font-medium text-[#171717]">Sales & profit:</span>{" "}
                      {inv.length} invoice{inv.length === 1 ? "" : "s"} sold from this mill&apos;s stock are removed - their revenue, dues and profit drop from Sales, Dashboard and Reports.
                    </li>
                  )}
                  <li>
                    <span className="font-medium text-[#171717]">Records:</span> payments made to this mill are removed too.
                  </li>
                </ul>
                <p className="text-xs font-semibold text-destructive mt-2.5">
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