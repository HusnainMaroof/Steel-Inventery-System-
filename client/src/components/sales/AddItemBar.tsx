"use client";

import { useState } from "react";
import { fmtMoney, fmtQtyWithUnit, perUnitLabel, qtyUnitLabel } from "@/lib/format";
import { NumberInput, OptionalSection } from "@/components/ui";
import type { SaleDraftApi } from "./useSaleDraft";

export default function AddItemBar({
  api,
  onAdd,
  showOptionalDetails = false,
}: {
  api: SaleDraftApi;
  onAdd: () => void;
  showOptionalDetails?: boolean;
}) {
  const { pick, setPick, pickVariant, pickUsesCats, variantRowsOf, draftAvail, draftUnit } = api;
  const [lotExpanded, setLotExpanded] = useState(false);
  const showLot = showOptionalDetails || lotExpanded;
  const items = api.categoriesOfProduct(pick.productId);
  const lots = api.pickVariant ? api.lotsOf(api.pickVariant.id) : [];
  const productName = api.prodById.get(pick.productId)?.name;
  const itemName = api.pickUsesCats ? api.catById.get(pick.categoryId)?.name : undefined;

  const scopeRows = pick.productId
    ? variantRowsOf(pick.productId, pickUsesCats ? pick.categoryId || undefined : undefined)
    : [];

  /* the picked size/grade/maker matches an item that has stock */
  const exactStocked = !!pickVariant && !api.noStockForCombo;
  /* the picked combination has no stock (no such item, or it is sold out) */
  const comboMissing = !!pick.productId && scopeRows.length > 0 && !exactStocked;
  const pickedStock = exactStocked ? draftAvail : 0;
  const pickedUnit = draftUnit || scopeRows[0]?.unit || "";
  const pickedLabel = `In stock ${fmtQtyWithUnit(pickedStock, pickedUnit)}`;
  const onSale = (variantId: string) =>
    api.lines.filter((l) => l.variantId === variantId).reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const pickedOnSale = exactStocked && pickVariant ? onSale(pickVariant.id) : 0;

  return (
    <div className="border border-[#E5E5E5] rounded-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-[#E5E5E5] bg-[#F8F8F7] flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-[#171717]">Add item</p>
        {!api.hasStock ? (
          <span className="text-[13px] text-[#171717]/70">No stock. Record a purchase first.</span>
        ) : null}
      </div>

      {!api.hasStock ? (
        <div className="px-5 py-8 text-center text-[13px] text-[#171717]/70">Nothing in stock to sell yet.</div>
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

          {api.attrChoices.length > 0 && (
            <div className="border border-[#E5E5E5] rounded-lg p-4 bg-[#F8F8F7]">
              <p className="text-xs font-medium text-[#171717]/60 mb-3">Attributes (only what is in stock)</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {api.attrChoices.map(({ def, values }) => (
                  <div key={def.id}>
                    <label htmlFor={`sale-attr-${def.id}`} className="!mb-1">{def.name}</label>
                    <select
                      id={`sale-attr-${def.id}`}
                      value={(pick.attrs[def.key] ?? "").trim()}
                      onChange={(e) => api.onAttrPick(def.key, e.target.value)}
                    >
                      {values.map((v) => (
                        <option key={v || "none"} value={v}>{v || "None"}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lots.length > 0 && (
            <OptionalSection
              title="Source / lot"
              hint="Optional - pick a specific lot or use FIFO (oldest first)"
              open={showLot}
              onToggle={() => setLotExpanded((expanded) => !expanded)}
            >
              <div>
                <label className="!mb-1">Lot</label>
                <select value={pick.lotId} onChange={(e) => setPick({ lotId: e.target.value })} className="w-full">
                  <option value="">Any lot - FIFO (oldest first)</option>
                  {lots.map((l) => (
                    <option key={l.purchaseId} value={l.purchaseId}>
                      {l.label} - {fmtQtyWithUnit(l.remaining, l.unit)} left
                    </option>
                  ))}
                </select>
              </div>
            </OptionalSection>
          )}

          <div className="pt-4 border-t border-[#E5E5E5] flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between gap-4">
            <div className="text-[13px] text-[#171717]/70 min-w-0 flex-1">
              {pick.productId && scopeRows.length > 0 ? (
                <>
                  <span className="font-medium text-[#171717]">{productName}</span>
                  {itemName ? ` · ${itemName}` : ""}
                  {comboMissing ? (
                    <span className="block sm:inline sm:ml-2 text-destructive">
                      This size, grade, or maker is not in stock.
                    </span>
                  ) : null}
                </>
              ) : (
                "Pick a product"
              )}
            </div>
            <div className="flex flex-wrap items-end gap-3 shrink-0 w-full sm:w-auto">
              <div className="flex flex-col min-w-0 flex-1 sm:flex-initial">
                <label className="!mb-1">Qty ({qtyUnitLabel(pickedUnit || api.draftUnit)})</label>
                <div className="flex items-stretch gap-2">
                  {exactStocked && pickedUnit ? (
                    <span
                      className="inline-flex items-center rounded-lg border border-[#E5E5E5] bg-[#F8F8F7] px-3 min-h-10 text-sm font-semibold tabular-nums text-[#171717] whitespace-nowrap"
                      title="What is left in inventory"
                    >
                      {pickedLabel}
                    </span>
                  ) : null}
                  <NumberInput
                    aria-label="Quantity"
                    decimals={3}
                    className={`!w-28 shrink-0 tabular-nums ${exactStocked && api.draftOver ? "!border-destructive" : ""}`}
                    value={pick.qty}
                    onValue={(n) => setPick({ qty: n })}
                  />
                </div>
              </div>
              {exactStocked ? (
                <>
                  <div className="flex flex-col min-w-0">
                    <label className="!mb-1">
                      Old selling price
                      <span className="font-normal text-[#171717]/70">{perUnitLabel(pickedUnit || api.draftUnit)}</span>
                    </label>
                    <span className="inline-flex items-center min-h-[40px] rounded-lg border border-[#E5E5E5] bg-[#F8F8F7] px-3 text-sm font-medium tabular-nums text-[#171717] whitespace-nowrap">
                      {api.oldSellRate > 0 ? fmtMoney(api.oldSellRate) : "-"}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <label className="!mb-1">
                      New selling price
                      <span className="font-normal text-[#171717]/70">{perUnitLabel(pickedUnit || api.draftUnit)}</span>
                    </label>
                    <NumberInput
                      placeholder="Optional"
                      className="!w-32 tabular-nums"
                      value={pick.rate}
                      onValue={(n) => setPick({ rate: n })}
                      disabled={!pickVariant}
                    />
                  </div>
                </>
              ) : null}
              <button
                type="button"
                className="btn-primary w-full sm:w-auto"
                onClick={onAdd}
                disabled={!api.canAdd}
              >
                Add item
              </button>
            </div>
          </div>

          {exactStocked && (Number(pick.qty) || 0) > pickedStock && (
            <p className="text-[13px] text-destructive">
              {pickedStock > 0
                ? `Only ${fmtQtyWithUnit(pickedStock, pickedUnit)} left of this item.`
                : pickedOnSale > 0
                  ? "All of this item is already on this sale."
                  : "This item is out of stock."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
