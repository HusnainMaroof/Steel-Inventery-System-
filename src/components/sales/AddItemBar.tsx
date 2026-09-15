"use client";

import { useState, useEffect } from "react";
import { fmtQtyWithUnit, fmtRateWithUnit, qtyUnitLabel } from "@/lib/format";
import { OptionalSection } from "@/components/ui";
import { AttributeFields } from "@/components/catalogue/AttributeFields";
import type { SaleDraftApi } from "./useSaleDraft";

const numVal = (n: number) => (n === 0 ? "" : String(n));

export default function AddItemBar({
  api,
  onAdd,
  showOptionalDetails = false,
}: {
  api: SaleDraftApi;
  onAdd: () => void;
  showOptionalDetails?: boolean;
}) {
  const { pick, setPick } = api;
  const [showLot, setShowLot] = useState(showOptionalDetails);
  const items = api.categoriesOfProduct(pick.productId);
  const lots = api.pickVariant ? api.lotsOf(api.pickVariant.id) : [];
  const v = api.pickVariant;
  const productName = api.prodById.get(pick.productId)?.name;
  const itemName = api.pickUsesCats ? api.catById.get(pick.categoryId)?.name : undefined;

  useEffect(() => {
    setShowLot(showOptionalDetails);
  }, [showOptionalDetails]);

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-neutral-800">Add item</p>
        {!api.hasStock ? (
          <span className="text-[12px] text-neutral-400">No stock — record a purchase first</span>
        ) : (
          <span className="text-[12px] text-neutral-400">Rate from stock lot</span>
        )}
      </div>

      {!api.hasStock ? (
        <div className="px-5 py-8 text-center text-[13px] text-neutral-400">Nothing in stock to sell yet.</div>
      ) : (
        <div className="p-4 sm:p-5 space-y-4">
          <div className={`grid grid-cols-1 ${api.pickUsesCats ? "sm:grid-cols-2" : ""} gap-4`}>
            <div>
              <label className="!mb-1">Product</label>
              <select value={pick.productId} onChange={(e) => api.onProduct(e.target.value)}>
                {api.productsWithStock.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            {api.pickUsesCats && (
              <div>
                <label className="!mb-1">Category</label>
                <select value={pick.categoryId} onChange={(e) => api.onCategory(e.target.value)}>
                  {items.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {api.pickDefs.length > 0 && (
            <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50/50">
              <p className="text-[12px] font-medium text-neutral-600 mb-3">Attributes</p>
              <AttributeFields
                defs={api.pickDefs}
                value={pick.attrs}
                onChange={api.onAttrs}
                optionsOf={(defId) => api.attributeOptions.filter((o) => o.attributeDefId === defId)}
              />
            </div>
          )}

          {lots.length > 0 && (
            <OptionalSection
              title="Source / lot"
              hint="Optional — pick a specific lot or use FIFO (oldest first)"
              open={showLot}
              onToggle={() => setShowLot((s) => !s)}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="!mb-1">Lot</label>
                  <select value={pick.lotId} onChange={(e) => setPick({ lotId: e.target.value })}>
                    <option value="">Any lot — FIFO (oldest first)</option>
                    {lots.map((l) => (
                      <option key={l.purchaseId} value={l.purchaseId}>
                        {l.label} — {fmtQtyWithUnit(l.remaining, l.unit)} left
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[13px] text-neutral-500 sm:pb-2">
                  Available:{" "}
                  <span className="font-semibold text-neutral-800 tabular-nums">
                    {fmtQtyWithUnit(api.draftAvail, api.draftUnit)}
                  </span>
                </p>
              </div>
            </OptionalSection>
          )}

          <div className="pt-4 border-t border-neutral-100 flex flex-wrap items-end justify-between gap-4">
            <div className="text-[13px] text-neutral-500 min-w-0 flex-1">
              {v && api.canAdd ? (
                <>
                  <span className="font-medium text-neutral-800">{productName}</span>
                  {itemName ? ` · ${itemName}` : ""}
                  {api.draftPrice ? (
                    <span className="ml-2 text-neutral-600 tabular-nums">
                      @ {fmtRateWithUnit(api.draftPrice ?? 0, api.draftUnit)}
                    </span>
                  ) : (
                    <span className="ml-2 text-neutral-400">no sell price — using cost + 15%</span>
                  )}
                </>
              ) : api.noStockForCombo ? (
                "This combination is not in stock."
              ) : api.notInStock ? (
                "Fill the attributes to match stock on hand."
              ) : (
                "Pick a product"
              )}
            </div>
            <div className="flex items-end gap-3 shrink-0">
              <div>
                <label className="!mb-1">Qty ({qtyUnitLabel(api.draftUnit)})</label>
                <input
                  type="number"
                  min="0"
                  max={api.draftAvail || undefined}
                  step="any"
                  className={`!w-28 ${api.draftOver ? "!border-red-600" : ""}`}
                  value={numVal(pick.qty)}
                  onChange={(e) => setPick({ qty: Number(e.target.value) })}
                />
              </div>
              <button type="button" className="btn-primary !py-2.5 !px-5 text-[13px]" onClick={onAdd} disabled={!api.canAdd}>
                Add item
              </button>
            </div>
          </div>

          {api.draftOver && (
            <p className="text-[12px] text-red-600">
              Only {fmtQtyWithUnit(api.draftAvail, api.draftUnit)} available for this item.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
