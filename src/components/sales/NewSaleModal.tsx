"use client";

import type { FormEvent } from "react";
import { Modal } from "@/components/ui";
import AddItemBar from "./AddItemBar";
import LineItemsTable from "./LineItemsTable";
import SaleSummaryPanel from "./SaleSummaryPanel";
import type { SaleDraftApi } from "./useSaleDraft";

export default function NewSaleModal({
  open,
  onClose,
  onSubmit,
  saleDate,
  setSaleDate,
  customers,
  existingId,
  setExistingId,
  onNewCustOpen,
  api,
  entSummary,
  itemsCount,
  showOptionalDetails = false,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  saleDate: string;
  setSaleDate: (d: string) => void;
  customers: { id: string; name: string; shop: string }[];
  existingId: string;
  setExistingId: (id: string) => void;
  onNewCustOpen: () => void;
  api: SaleDraftApi;
  entSummary: {
    subtotal: number;
    discountPct: number;
    setDiscountPct: (n: number) => void;
    taxPct: number;
    setTaxPct: (n: number) => void;
    discAmt: number;
    taxAmt: number;
    loadingCharges: number;
    setLoadingCharges: (n: number) => void;
    transportCharges: number;
    setTransportCharges: (n: number) => void;
    labourCharges: number;
    setLabourCharges: (n: number) => void;
    chargesAmt: number;
    grandTotal: number;
    paidNow: number;
    setPaidNow: (n: number) => void;
    remaining: number;
    payError?: string;
    customerName: string;
    canSave: boolean;
  };
  itemsCount: number;
  showOptionalDetails?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Sale"
      subtitle="Build an invoice — stock is deducted when you save"
      full
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12px] text-neutral-400 tabular-nums">{itemsCount} item{itemsCount === 1 ? "" : "s"} on invoice</span>
          <div className="flex gap-2.5">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" form="new-sale-form" className="btn-primary" disabled={!entSummary.canSave}>Save Sale</button>
          </div>
        </div>
      }
    >
      <form id="new-sale-form" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 xl:gap-8 items-start">
          {/* left: customer + items */}
          <div className="min-w-0 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <div>
                <label>Date</label>
                <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} required />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="!mb-0">Customer</label>
                  <button type="button" onClick={onNewCustOpen} className="text-[12px] font-medium text-neutral-500 hover:text-black">
                    + New customer
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

            <AddItemBar api={api} onAdd={api.addDraftItem} showOptionalDetails={showOptionalDetails} />

            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-[13px] font-semibold text-neutral-800">Items on this invoice</p>
                <span className="text-[12px] text-neutral-400 tabular-nums">{itemsCount} item{itemsCount === 1 ? "" : "s"}</span>
              </div>
              <LineItemsTable api={api} />
            </div>
          </div>

          {/* right: summary */}
          <div className="min-w-0 xl:sticky xl:top-0">
            <SaleSummaryPanel
              subtotal={entSummary.subtotal}
              discountPct={entSummary.discountPct}
              setDiscountPct={entSummary.setDiscountPct}
              taxPct={entSummary.taxPct}
              setTaxPct={entSummary.setTaxPct}
              discAmt={entSummary.discAmt}
              taxAmt={entSummary.taxAmt}
              loadingCharges={entSummary.loadingCharges}
              setLoadingCharges={entSummary.setLoadingCharges}
              transportCharges={entSummary.transportCharges}
              setTransportCharges={entSummary.setTransportCharges}
              labourCharges={entSummary.labourCharges}
              setLabourCharges={entSummary.setLabourCharges}
              chargesAmt={entSummary.chargesAmt}
              grandTotal={entSummary.grandTotal}
              paidNow={entSummary.paidNow}
              setPaidNow={entSummary.setPaidNow}
              remaining={entSummary.remaining}
              payError={entSummary.payError}
              customerName={entSummary.customerName}
              canSave={entSummary.canSave}
              hideSubmit
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
