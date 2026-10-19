"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useStore, saleGrandTotal } from "@/lib/store";
import { BusyButton, Page, PageTitle, Modal, ConfirmModal, useToggle, EmptyState, RowActionsMenu, CustomSelect } from "@/components/ui";
import { Search } from "lucide-react";
import ReceivePaymentModal from "@/components/ReceivePaymentModal";
import CustomerHistoryModal from "@/components/customers/CustomerHistoryModal";
import { fmtMoney } from "@/lib/format";
import Decimal from "decimal.js";
import { toDecimal } from "../../../lib/decimal";
import { userFacingError } from "@/lib/user-error";


export default function CustomersPage() {
  const { customers, sales, salePaid, addCustomer, deleteCustomer, isPending } = useStore();
  const activeCustomers = customers.filter((customer) => customer.active !== false);
  const [paySaleId, setPaySaleId] = useState<string | null>(null);
  const { open, onOpen, onClose } = useToggle();
  const [form, setForm] = useState({ name: "", shop: "", phone: "" });

  const [searchInput, setSearchInput] = useState("");
  const [searchMode, setSearchMode] = useState<"name" | "phone">("name");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedMode, setAppliedMode] = useState<"name" | "phone">("name");

  const [viewCustomerId, setViewCustomerId] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("view");
    if (id) setViewCustomerId(id);
  }, []);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; shop: string; phone: string } | null>(null);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDeleteCustomer = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteCustomer(deleteTarget.id);
      if (viewCustomerId === deleteTarget.id) setViewCustomerId(null);
      setDeleteTarget(null);
    } catch (reason) {
      setDeleteError(userFacingError(reason, "Could not delete this customer."));
    }
  };

  // Closing the history also drops ?view= so a reload does not reopen it.
  const closeHistory = () => {
    setViewCustomerId(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("view")) {
      url.searchParams.delete("view");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  };

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 11);
    return digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
  };

  const onSearchChange = (v: string) => {
    setSearchInput(searchMode === "phone" ? formatPhone(v) : v);
  };

  const [savingCustomer, setSavingCustomer] = useState(false);
  const savingCustomerRef = useRef(false);

  const [customerError, setCustomerError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingCustomerRef.current || !form.name.trim() || isPending("customer:create")) return;
    savingCustomerRef.current = true;
    setSavingCustomer(true);
    setCustomerError(null);
    try {
      await addCustomer({ name: form.name.trim(), shop: form.shop.trim(), phone: form.phone.trim() });
      setForm({ name: "", shop: "", phone: "" });
      onClose();
    } catch (reason) {
      setCustomerError(userFacingError(reason, "Could not save this customer."));
    } finally {
      savingCustomerRef.current = false;
      setSavingCustomer(false);
    }
  };

  const rows = useMemo(() => {
    const q = appliedSearch.toLowerCase().trim();
    return activeCustomers
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
  }, [activeCustomers, appliedSearch, appliedMode]);

  return (
    <Page>
      <PageTitle
        title="Customers"
        sub="Balances and payment history for every customer"
        action={<button className="btn-primary" onClick={onOpen}>+ New Customer</button>}
      />

      {activeCustomers.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <CustomSelect
            value={searchMode}
            onChange={(v) => setSearchMode(v as "name" | "phone")}
            options={[
              { value: "name", label: "Name" },
              { value: "phone", label: "Phone" },
            ]}
            ariaLabel="Search by"
            compact
            className="w-40 shrink-0"
          />
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#171717]/70 pointer-events-none" />
            <input
              type="text"
              placeholder={searchMode === "name" ? "Search by name..." : "Search by phone..."}
              aria-label={searchMode === "name" ? "Search by name" : "Search by phone"}
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setAppliedSearch(searchInput); setAppliedMode(searchMode); } }}
              className="!pl-9"
            />
          </div>
          <button onClick={() => { setAppliedSearch(searchInput); setAppliedMode(searchMode); }} className="btn-ghost whitespace-nowrap">
            Search
          </button>
          {appliedSearch.trim() !== "" && (
            <button onClick={() => { setSearchInput(""); setAppliedSearch(""); setSearchMode("name"); setAppliedMode("name"); }} className="btn-ghost whitespace-nowrap">
              Clear
            </button>
          )}
        </div>
      )}

      {activeCustomers.length === 0 ? (
        <EmptyState
          icon={<Search className="w-6 h-6 text-[#171717]/70" />}
          title="No customers yet"
          hint="Add the shops you sell to — their balances and ledgers will live here."
          action={<button className="btn-primary" onClick={onOpen}>+ New Customer</button>}
        />
      ) : (
        <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FAFAF9]">
                <th className="text-xs uppercase tracking-wide text-[#171717]/60 text-left font-medium py-3 px-4">Customer</th>
                <th className="text-xs uppercase tracking-wide text-[#171717]/60 text-left font-medium py-3 px-4">Shop / Area</th>
                <th className="text-xs uppercase tracking-wide text-[#171717]/60 text-left font-medium py-3 px-4">Phone</th>
                <th className="text-xs uppercase tracking-wide text-[#171717]/60 text-right font-medium py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer hover:bg-[#F8F8F7] transition-colors"
                  onClick={() => setViewCustomerId(c.id)}
                >
                  <td className="py-3 px-4 border-t border-[#E5E5E5]">
                    <span className="font-medium text-[#171717] truncate block text-sm">{c.name}</span>
                  </td>
                  <td className="py-3 px-4 border-t border-[#E5E5E5]">
                    <span className="text-[#171717]/70 truncate block text-sm">{c.shop || "—"}</span>
                  </td>
                  <td className="py-3 px-4 border-t border-[#E5E5E5]">
                    <span className="text-[#171717]/70 tabular-nums text-sm">{c.phone || "—"}</span>
                  </td>
                  <td className="py-3 px-4 border-t border-[#E5E5E5] text-right">
                    <span onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu
                        items={[
                          { label: "View history", onClick: () => setViewCustomerId(c.id) },
                          { label: "Delete", onClick: () => setDeleteTarget(c), danger: true },
                        ]}
                        ariaLabel={`Actions for ${c.name}`}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CustomerHistoryModal
        customerId={viewCustomerId}
        onClose={closeHistory}
        onReceive={(saleId) => {
          closeHistory();
          setPaySaleId(saleId);
        }}
      />

      <Modal open={open} onClose={onClose} busy={savingCustomer || isPending("customer:create")} title="New Customer">
        {customerError && (
          <div role="alert" className="text-[13px] font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3.5 py-2.5 mb-5">
            {customerError}
          </div>
        )}
        <form onSubmit={save} className="grid gap-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-[#171717]/60">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ahmed Steel Mart" required autoFocus className="mt-1" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-[#171717]/60">Shop / Area</label>
            <input value={form.shop} onChange={(e) => setForm({ ...form, shop: e.target.value })} placeholder="e.g. Bilal Gunj, Lahore" className="mt-1" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-[#171717]/60">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. 0300 1234567" className="mt-1" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={savingCustomer || isPending("customer:create")}>Cancel</button>
            <BusyButton type="submit" loading={savingCustomer || isPending("customer:create")} disabled={!form.name.trim()}>
              Add Customer
            </BusyButton>
          </div>
        </form>
      </Modal>

      {/* Delete Customer Confirm Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteError(null); }}
        onConfirm={confirmDeleteCustomer}
        error={deleteError}
        title="Delete this customer?"
        confirmLabel="Delete Customer"
        loading={deleteTarget ? isPending(`customer:delete:${deleteTarget.id}`) : false}
      >
        {deleteTarget && (() => {
          const t = deleteTarget;
          const inv = sales.filter((s) => s.customerId === t.id);
          const total = inv.reduce((a, s) => a.plus(toDecimal(saleGrandTotal(s))), new Decimal(0)).toNumber();
          const paid = inv.reduce((a, s) => a.plus(toDecimal(salePaid(s.id))), new Decimal(0)).toNumber();
          const due = Math.max(0, total - paid);
          return (
            <>
              <div className="border border-[#E5E5E5] mb-6">
                <div className="flex justify-between items-center gap-3 py-2.5 px-4 border-b border-[#E5E5E5]">
                  <span className="text-sm font-medium truncate">{t.name}</span>
                  <span className="text-xs text-[#171717]/70 shrink-0 tabular-nums">{t.phone || "—"}</span>
                </div>
                <div className="flex justify-between py-2 px-4 border-b border-[#E5E5E5] text-xs">
                  <span className="text-[#171717]/70">Shop / Area</span>
                  <span className="tabular-nums">{t.shop || "—"}</span>
                </div>
                <div className="flex justify-between py-2 px-4 border-b border-[#E5E5E5] text-xs">
                  <span className="text-[#171717]/70">Invoices on record</span>
                  <span className="tabular-nums">{inv.length}</span>
                </div>
                {due > 0 && (
                  <div className="flex justify-between py-2 px-4 text-xs">
                    <span className="text-[#171717]/70">They owe you</span>
                    <span className="tabular-nums font-medium text-destructive">{fmtMoney(due)}</span>
                  </div>
                )}
              </div>
              <div className="border border-destructive/20 bg-destructive/10 p-4 rounded-lg">
                <p className="text-xs uppercase tracking-widest text-destructive font-medium mb-2">Deleting changes your numbers</p>
                <ul className="text-xs text-[#171717]/70 space-y-1.5 list-disc pl-4">
                  <li>
                    <span className="font-medium text-[#171717]">Customer dues:</span>{" "}
                    {due > 0
                      ? `their unpaid ${fmtMoney(due)} is cleared, so Customer Payment Dues on the dashboard falls.`
                      : "they have paid everything, so no due changes."}
                  </li>
                  <li>
                    <span className="font-medium text-[#171717]">Sales & records:</span>{" "}
                    {inv.length} invoice{inv.length === 1 ? "" : "s"} and their payments are removed.
                  </li>
                  <li>
                    <span className="font-medium text-[#171717]">Stock:</span> sold goods return to Inventory, so those stock rows grow again.
                  </li>
                  <li>
                    <span className="font-medium text-[#171717]">Profit:</span> that revenue and its profit leave Sales, Dashboard and Reports.
                  </li>
                </ul>
                <p className="text-xs font-semibold text-destructive mt-2.5">
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
