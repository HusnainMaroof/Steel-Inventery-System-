"use client";

import { useState } from "react";
import { qtyUnitLabel, perUnitLabel } from "@/lib/format";
import { OptionalSection } from "@/components/ui";
import { AttributeFields, validateAttributes } from "@/components/catalogue/AttributeFields";
import type { PurchaseDraftApi } from "./usePurchaseDraft";

const numVal = (n: number) => (n === 0 ? "" : String(n));

/** Single-item purchase fields (no add-to-queue). */
export default function PurchaseItemForm({
  api,
  showOptionalDetails = false,
}: {
  api: PurchaseDraftApi;
  showOptionalDetails?: boolean;
}) {
  const { pick, setPick } = api;
  const [lotExpanded, setLotExpanded] = useState(false);
  const showLot = showOptionalDetails || lotExpanded;
  const perLabel = perUnitLabel(api.productUnit);
  const qtyLabel = qtyUnitLabel(api.productUnit);
  const attrErrors = validateAttributes(api.pickDefs, pick.attrs);

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-neutral-100 bg-neutral-50/50">
        <p className="text-[13px] font-semibold text-neutral-800">Item</p>
        <p className="text-[12px] text-neutral-400 mt-0.5">One product per purchase — totals update live on the right</p>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div className={`grid grid-cols-1 ${api.usesCats ? "sm:grid-cols-2" : ""} gap-4`}>
          <div>
            <label className="!mb-1">Product</label>
            <select value={pick.productId} onChange={(e) => api.onProduct(e.target.value)}>
              {api.activeProducts.length === 0 && <option value="">No products</option>}
              {api.activeProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {api.usesCats && (
            <div>
              <label className="!mb-1">Category</label>
              <select value={pick.categoryId} onChange={(e) => api.onCategory(e.target.value)}>
                {api.catsOfProduct.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {api.pickDefs.length > 0 && (
          <AttributeFields
            defs={api.pickDefs}
            value={pick.attrs}
            onChange={(patch) => setPick({ attrs: { ...pick.attrs, ...patch } })}
            optionsOf={(defId) => api.attributeOptions.filter((o) => o.attributeDefId === defId)}
            requiredError={Object.keys(attrErrors).length ? attrErrors : undefined}
            gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="!mb-1">Qty ({qtyLabel})</label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={numVal(pick.qty)}
              onChange={(e) => setPick({ qty: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="!mb-1">Buying price ({perLabel})</label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={numVal(pick.rate)}
              onChange={(e) => setPick({ rate: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="!mb-1">Selling price ({perLabel})</label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Optional"
              value={numVal(pick.sellRate)}
              onChange={(e) => setPick({ sellRate: Number(e.target.value) })}
            />
          </div>
        </div>

        <OptionalSection
          title="Lot & location"
          hint="Optional traceability"
          open={showLot}
          onToggle={() => setLotExpanded((e) => !e)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="!mb-1">Lot number</label>
              <input
                value={pick.lotNumber}
                onChange={(e) => setPick({ lotNumber: e.target.value })}
                placeholder="e.g. LOT-001"
              />
            </div>
            <div>
              <label className="!mb-1">Heat number</label>
              <input
                value={pick.heatNumber}
                onChange={(e) => setPick({ heatNumber: e.target.value })}
                placeholder="e.g. H92831"
              />
            </div>
            <div>
              <label className="!mb-1">Batch number</label>
              <input
                value={pick.batchNumber}
                onChange={(e) => setPick({ batchNumber: e.target.value })}
                placeholder="e.g. LC-77342"
              />
            </div>
            {api.warehouses.length > 0 ? (
              <>
                <div>
                  <label className="!mb-1">Warehouse</label>
                  <select
                    value={pick.warehouseId}
                    onChange={(e) => setPick({ warehouseId: e.target.value, locationId: "" })}
                  >
                    <option value="">—</option>
                    {api.warehouses
                      .filter((w) => w.active !== false)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="!mb-1">Location</label>
                  <select
                    value={pick.locationId}
                    onChange={(e) => setPick({ locationId: e.target.value })}
                    disabled={!api.warehouse}
                  >
                    <option value="">—</option>
                    {api.whLocations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
          </div>
        </OptionalSection>
      </div>
    </div>
  );
}
