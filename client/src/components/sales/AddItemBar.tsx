"use client";

import { useState } from "react";
import { fmtQtyWithUnit, perUnitLabel, qtyUnitLabel } from "@/lib/format";
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
  const { pick, setPick, lines, pickVariant, pickUsesCats, variantRowsOf, draftAvail, draftUnit } = api;
  const [lotExpanded, setLotExpanded] = useState(false);
  const showLot = showOptionalDetails || lotExpanded;
  const items = api.categoriesOfProduct(pick.productId);
  const lots = api.pickVariant ? api.lotsOf(api.pickVariant.id) : [];
  const productName = api.prodById.get(pick.productId)?.name;
  const itemName = api.pickUsesCats ? api.catById.get(pick.categoryId)?.name : undefined;

  const scopeRows = pick.productId
    ? variantRowsOf(pick.productId, pickUsesCats ? pick.categoryId || undefined : undefined)
    : [];
  const scopeUnit = draftUnit || scopeRows[0]?.unit || "";
  const scopeStockGross = scopeRows.reduce((a, r) => a + r.stockQty, 0);
  const scopeVariantIds = new Set(scopeRows.map((r) => r.variantId));
  const onInvoiceInScope = lines
    .filter((l) => scopeVariantIds.has(l.variantId))
    .reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const stockOnHand = pickVariant ? draftAvail : Math.max(0, scopeStockGross - onInvoiceInScope);

  const maxQtyLabel = scopeUnit ? fmtQtyWithUnit(stockOnHand, scopeUnit) : "";

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-neutral-800">Add item</p>
        {!api.hasStock ? (
          <span className="text-[12px] text-neutral-400">No stock — record a purchase first</span>
        ) : (
          <span className="text-[12px] text-neutral-400">Price prefilled from stock — edit before adding</span>
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
              onToggle={() => setLotExpanded((expanded) => !expanded)}
            >
              <div>
                <label className="!mb-1">Lot</label>
                <select value={pick.lotId} onChange={(e) => setPick({ lotId: e.target.value })} className="w-full">
                  <option value="">Any lot — FIFO (oldest first)</option>
                  {lots.map((l) => (
                    <option key={l.purchaseId} value={l.purchaseId}>
                      {l.label} — {fmtQtyWithUnit(l.remaining, l.unit)} left
                    </option>
                  ))}
                </select>
              </div>
            </OptionalSection>
          )}

          <div className="pt-4 border-t border-neutral-100 flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between gap-4">
            <div className="text-[13px] text-neutral-500 min-w-0 flex-1">
              {pick.productId && scopeRows.length > 0 ? (
                <>
                  <span className="font-medium text-neutral-800">{productName}</span>
                  {itemName ? ` · ${itemName}` : ""}
                  {api.noStockForCombo ? (
                    <span className="block sm:inline sm:ml-2 text-neutral-500">This combination is not in stock.</span>
                  ) : api.notInStock ? (
                    <span className="block sm:inline sm:ml-2 text-neutral-500">Fill attributes to match stock.</span>
                  ) : null}
                </>
              ) : api.noStockForCombo ? (
                "This combination is not in stock."
              ) : api.notInStock ? (
                "Fill the attributes to match stock on hand."
              ) : (
                "Pick a product"
              )}
            </div>
            <div className="flex flex-wrap items-end gap-3 shrink-0 w-full sm:w-auto">
              {pickVariant && pick.productId && scopeRows.length > 0 ? (
                <div className="flex flex-col min-w-0">
                  <label className="!mb-1">
                    Selling price
                    <span className="font-normal text-neutral-400">{perUnitLabel(scopeUnit || api.draftUnit)}</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="!w-32 tabular-nums"
                    value={numVal(pick.rate)}
                    onChange={(e) => setPick({ rate: Number(e.target.value) })}
                    disabled={!pickVariant}
                    title={
                      api.suggestedSellRate > 0 && pick.rate !== api.suggestedSellRate
                        ? `Stock list price: ${api.suggestedSellRate}`
                        : undefined
                    }
                  />
                </div>
              ) : null}
              <div className="flex flex-col min-w-0 flex-1 sm:flex-initial">
                <label className="!mb-1">Qty ({qtyUnitLabel(scopeUnit || api.draftUnit)})</label>
                <div className="flex items-stretch gap-2">
                  {scopeUnit && pick.productId && scopeRows.length > 0 ? (
                    <span
                      className="inline-flex items-center rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-[13px] font-semibold tabular-nums text-neutral-900 whitespace-nowrap"
                      title="Maximum you can add for this item"
                    >
                      Max {maxQtyLabel}
                    </span>
                  ) : null}
                  <input
                    type="number"
                    min="0"
                    max={stockOnHand || api.draftAvail || undefined}
                    step="any"
                    className={`!w-28 shrink-0 ${api.draftOver ? "!border-red-600" : ""}`}
                    value={numVal(pick.qty)}
                    onChange={(e) => setPick({ qty: Number(e.target.value) })}
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn-primary !py-2.5 !px-5 text-[13px] w-full sm:w-auto"
                onClick={onAdd}
                disabled={!api.canAdd}
              >
                Add item
              </button>
            </div>
          </div>

          {(api.draftOver || (Number(pick.qty) || 0) > stockOnHand) && scopeUnit && (
            <p className="text-[12px] text-red-600">
              Only {fmtQtyWithUnit(stockOnHand, scopeUnit)} remaining for this item.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
