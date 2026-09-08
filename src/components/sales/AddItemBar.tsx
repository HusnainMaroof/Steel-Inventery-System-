"use client";

import { fmtQtyWithUnit, fmtRateWithUnit, qtyUnitLabel } from "@/lib/format";

interface Draft {
  product: string;
  item: string;
  quality: string;
  supplierId: string;
  qty: number;
}

const numVal = (n: number) => (n === 0 ? "" : String(n));

export default function AddItemBar({
  draft,
  setDraft,
  onDraftProduct,
  onDraftItem,
  onDraftQuality,
  productsWithStock,
  itemsOf,
  qualitiesOf,
  sourcesOf,
  sourceUnits,
  availOf,
  supplierName,
  draftAvail,
  draftUnit,
  draftPrice,
  draftOver,
  canAdd,
  onAdd,
  hasStock,
}: {
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  onDraftProduct: (product: string) => void;
  onDraftItem: (item: string) => void;
  onDraftQuality: (quality: string) => void;
  productsWithStock: string[];
  itemsOf: (product: string) => { item: string }[];
  qualitiesOf: (item: string) => string[];
  sourcesOf: (item: string, quality?: string) => {
    supplierId?: string;
    stockQty: number;
    unit?: string;
  }[];
  sourceUnits: (item: string, supplierId: string) => string;
  availOf: (item: string, quality: string, supplierId: string) => number;
  supplierName: (id: string) => string;
  draftAvail: number;
  draftUnit: string;
  draftPrice?: number;
  draftOver: boolean;
  canAdd: boolean;
  onAdd: () => void;
  hasStock: boolean;
}) {
  return (
    <div className="mt-8 border border-neutral-200 rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <label className="!mb-0 text-[12px]">Add Item</label>
        {!hasStock ? (
          <span className="text-xs text-neutral-400">No stock yet — record a purchase first</span>
        ) : (
          <span className="text-xs text-neutral-400">Price is auto-set from inventory</span>
        )}
      </div>

      {!hasStock ? null : (
        <>
          {/* filter surface — what you're narrowing down */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 sm:p-4">
            <p className="text-[11px] uppercase tracking-widest text-neutral-400 mb-3">Find stock to sell</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
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
                <select value={draft.supplierId} onChange={(e) => setDraft({ supplierId: e.target.value, qty: 1 })}>
                  <option value="" disabled>
                    {sourcesOf(draft.item, draft.quality).length === 0 ? "No stock…" : "Select mill…"}
                  </option>
                  {sourcesOf(draft.item, draft.quality).map((r) => (
                    <option key={r.supplierId} value={r.supplierId ?? ""} disabled={r.stockQty <= 0}>
                      {supplierName(r.supplierId ?? "")} — {fmtQtyWithUnit(availOf(draft.item, draft.quality, r.supplierId ?? ""), sourceUnits(draft.item, r.supplierId ?? ""))} left
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* confirmation + commit row */}
          <div className="mt-3 pt-3 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
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
            <div className="flex items-end gap-3">
              <div>
                <label className="!mb-1">Qty ({qtyUnitLabel(draftUnit)})</label>
                <input
                  type="number" min="0" max={draftAvail || undefined} step="any"
                  className={`!w-28 ${draftOver ? "!border-red-600" : ""}`}
                  value={numVal(draft.qty)}
                  onChange={(e) => setDraft({ qty: Number(e.target.value) })}
                />
              </div>
              <button type="button" className="btn-primary !py-2 !px-4 text-xs" onClick={onAdd} disabled={!canAdd}>
                + Add Item
              </button>
            </div>
          </div>

          {draftOver && (
            <p className="text-[11px] text-red-600 mt-1.5">
              Only {fmtQtyWithUnit(draftAvail, draftUnit)} available of this mill&apos;s stock.
            </p>
          )}
        </>
      )}
    </div>
  );
}