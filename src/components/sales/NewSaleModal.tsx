"use client";

import type { FormEvent } from "react";
import { Modal } from "@/components/ui";
import AddItemBar from "./AddItemBar";
import LineItemsTable from "./LineItemsTable";
import SaleSummaryPanel from "./SaleSummaryPanel";

interface LineForm {
  product: string;
  item: string;
  spec?: string;
  quality: string;
  supplierId: string;
  purchaseId?: string;
  qty: number;
  rate: number;
}

interface Draft {
  product: string;
  item: string;
  spec?: string;
  quality: string;
  supplierId: string;
  qty: number;
}

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
  draft,
  setDraft,
  onDraftProduct,
  onDraftItem,
  onDraftSpec,
  onDraftQuality,
  productsWithStock,
  itemsOf,
  specsOf,
  qualitiesOf,
  sourcesOf,
  productSpecLabel,
  sourceUnits,
  availOf,
  supplierName,
  unitOf,
  draftAvail,
  draftUnit,
  draftPrice,
  draftOver,
  canAdd,
  onAddItem,
  lines,
  setLine,
  removeLine,
  lineOver,
  entSummary,
  itemsCount,
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
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  onDraftProduct: (p: string) => void;
  onDraftItem: (i: string) => void;
  onDraftSpec: (s: string) => void;
  onDraftQuality: (q: string) => void;
  productsWithStock: string[];
  itemsOf: (product: string) => { item: string }[];
  specsOf: (item: string) => string[];
  qualitiesOf: (item: string, spec?: string) => string[];
  sourcesOf: (item: string, quality?: string, spec?: string) => { supplierId?: string; stockQty: number; unit?: string }[];
  productSpecLabel: (product: string) => string;
  sourceUnits: (item: string, spec: string | undefined, supplierId: string) => string;
  availOf: (item: string, quality: string, spec: string | undefined, supplierId: string) => number;
  supplierName: (id: string) => string;
  unitOf: (item: string) => string;
  draftAvail: number;
  draftUnit: string;
  draftPrice?: number;
  draftOver: boolean;
  canAdd: boolean;
  onAddItem: () => void;
  lines: LineForm[];
  setLine: (i: number, patch: Partial<LineForm>) => void;
  removeLine: (i: number) => void;
  lineOver: (l: LineForm) => boolean;
  entSummary: {
    subtotal: number;
    discountPct: number;
    setDiscountPct: (n: number) => void;
    taxPct: number;
    setTaxPct: (n: number) => void;
    discAmt: number;
    taxAmt: number;
    grandTotal: number;
    paidNow: number;
    setPaidNow: (n: number) => void;
    remaining: number;
    payError?: string;
    customerName: string;
    canSave: boolean;
  };
  itemsCount: number;
}) {
  return (
    <Modal open={open} onClose={onClose} title="New Sale" full>
      <form onSubmit={onSubmit}>
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-[22px] sm:text-2xl font-semibold tracking-tight">New Sale</h1>
          <div className="flex gap-2.5">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!entSummary.canSave}>Save Sale</button>
          </div>
        </div>

        {/* two-column workspace */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 items-start">
          {/* left: customer + items */}
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

            {/* find-stock + add */}
            <AddItemBar
              draft={draft}
              setDraft={setDraft}
              onDraftProduct={onDraftProduct}
              onDraftItem={onDraftItem}
              onDraftSpec={onDraftSpec}
              onDraftQuality={onDraftQuality}
              productsWithStock={productsWithStock}
              itemsOf={itemsOf}
              specsOf={specsOf}
              qualitiesOf={qualitiesOf}
              sourcesOf={sourcesOf}
              productSpecLabel={productSpecLabel}
              sourceUnits={sourceUnits}
              availOf={availOf}
              supplierName={supplierName}
              draftAvail={draftAvail}
              draftUnit={draftUnit}
              draftPrice={draftPrice}
              draftOver={draftOver}
              canAdd={canAdd}
              onAdd={onAddItem}
              hasStock={productsWithStock.length > 0}
            />

            {/* line items */}
            <div className="mt-8">
              <div className="flex items-center justify-between gap-2 mb-3">
                <label className="!mb-0 text-[12px]">Items on this invoice</label>
                <span className="text-xs text-neutral-400 tabular-nums">{itemsCount} item{itemsCount === 1 ? "" : "s"}</span>
              </div>
              <LineItemsTable
                lines={lines}
                setLine={setLine}
                removeLine={removeLine}
                unitOf={unitOf}
                supplierName={supplierName}
                lineOver={lineOver}
              />
            </div>
          </div>

          {/* right: summary panel */}
          <div className="min-w-0">
            <SaleSummaryPanel
              subtotal={entSummary.subtotal}
              discountPct={entSummary.discountPct}
              setDiscountPct={entSummary.setDiscountPct}
              taxPct={entSummary.taxPct}
              setTaxPct={entSummary.setTaxPct}
              discAmt={entSummary.discAmt}
              taxAmt={entSummary.taxAmt}
              grandTotal={entSummary.grandTotal}
              paidNow={entSummary.paidNow}
              setPaidNow={entSummary.setPaidNow}
              remaining={entSummary.remaining}
              payError={entSummary.payError}
              customerName={entSummary.customerName}
              canSave={entSummary.canSave}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}