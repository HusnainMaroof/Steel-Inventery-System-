"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";

export interface LineForm {
  product: string;
  item: string;
  quality: string;
  supplierId: string;
  purchaseId?: string;
  qty: number;
  rate: number;
}

export interface Draft {
  product: string;
  item: string;
  quality: string;
  supplierId: string;
  qty: number;
}

export function useSaleDraft() {
  const { customers, inventory, suppliers, inventoryBySource, stockLots } = useStore();

  /* ---- sellable stock rows ---- */
  const invMap = useMemo(() => Object.fromEntries(inventory.map((r) => [r.item, r])), [inventory]);
  const unitOf = (item: string) => invMap[item]?.unit ?? "";
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "—";

  const sourceRows = inventoryBySource.filter((r) => r.stockQty > 0);
  const sourceStockOf = (item: string, supplierId: string) =>
    inventoryBySource.find((r) => r.item === item && r.supplierId === supplierId)?.stockQty ?? 0;
  const sourceUnitCostOf = (item: string, supplierId: string) =>
    inventoryBySource.find((r) => r.item === item && r.supplierId === supplierId)?.landedAvg ?? 0;
  const sourceUnitOf = (item: string, supplierId: string) =>
    inventoryBySource.find((r) => r.item === item && r.supplierId === supplierId)?.unit ?? unitOf(item);
  const sellPriceOf = (item: string, quality: string, supplierId: string) =>
    stockLots.find(
      (l) => l.item === item && l.quality === quality && l.supplierId === supplierId && l.sellPrice
    )?.sellPrice;

  const productsWithStock = useMemo(
    () =>
      Array.from(new Set(sourceRows.map((r) => r.product))).filter((p): p is string => !!p).sort(),
    [sourceRows]
  );
  const itemsOf = (product: string) => sourceRows.filter((r) => r.product === product);
  const qualitiesOf = (item: string) =>
    Array.from(new Set(sourceRows.filter((r) => r.item === item && r.quality).map((r) => r.quality as string)));
  const sourcesOf = (item: string, quality = "") =>
    sourceRows.filter((r) => r.item === item && (!quality || r.quality === quality));

  /* ---- the "add item" draft ---- */
  const freshDraft = (): Draft => {
    const prod = productsWithStock[0] ?? "";
    const itemRow = itemsOf(prod)[0];
    const qual = (itemRow?.quality ?? "") || "";
    const src = sourcesOf(itemRow?.item ?? "", qual)[0];
    return {
      product: prod,
      item: itemRow?.item ?? "",
      quality: qual,
      supplierId: src?.supplierId ?? "",
      qty: 1,
    };
  };
  const [draft, setDraftState] = useState<Draft>(freshDraft);
  const setDraft = (patch: Partial<Draft>) => setDraftState((d) => ({ ...d, ...patch }));

  const onDraftProduct = (product: string) => {
    const row = itemsOf(product)[0];
    const item = row?.item ?? "";
    const qual = (row?.quality ?? "") || "";
    setDraftState({
      ...freshDraft(),
      product,
      item,
      quality: qual,
      supplierId: sourcesOf(item, qual)[0]?.supplierId ?? "",
      qty: 1,
    });
  };
  const onDraftItem = (item: string) => {
    const qual = qualitiesOf(item)[0] ?? "";
    setDraftState((d) => ({
      ...d,
      item,
      quality: qual,
      supplierId: sourcesOf(item, qual)[0]?.supplierId ?? "",
      qty: 1,
    }));
  };
  const onDraftQuality = (quality: string) => {
    setDraftState((d) => ({
      ...d,
      quality,
      supplierId: sourcesOf(d.item, quality)[0]?.supplierId ?? "",
      qty: 1,
    }));
  };

  /* ---- added lines ---- */
  const [lines, setLines] = useState<LineForm[]>([]);

  const setLine = (i: number, patch: Partial<LineForm>) =>
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, j) => j !== i));

  // stock still available for a draft combo = source stock minus what's already on the sale
  const availOf = (item: string, quality: string, supplierId: string) => {
    const total = sourceStockOf(item, supplierId);
    const used = lines
      .filter((l) => l.item === item && l.quality === quality && l.supplierId === supplierId)
      .reduce((a, l) => a + (Number(l.qty) || 0), 0);
    return Math.max(0, total - used);
  };
  const draftAvail = availOf(draft.item, draft.quality, draft.supplierId);
  const draftOver = (Number(draft.qty) || 0) > draftAvail;
  const draftUnit = unitOf(draft.item);
  const draftPrice = draft.item && draft.supplierId ? sellPriceOf(draft.item, draft.quality, draft.supplierId) : undefined;
  const canAdd = !!draft.item && !!draft.supplierId && !draftOver && (Number(draft.qty) || 0) > 0;
  const lineOver = (l: LineForm) => {
    const stock = sourceStockOf(l.item, l.supplierId);
    const otherLinesQty = lines
      .filter((ol) => ol !== l && ol.item === l.item && ol.supplierId === l.supplierId)
      .reduce((a, ol) => a + (Number(ol.qty) || 0), 0);
    return (Number(l.qty) || 0) > stock - otherLinesQty;
  };

  const addDraftItem = () => {
    if (!canAdd) return;
    const unitCost = sourceUnitCostOf(draft.item, draft.supplierId);
    const price = sellPriceOf(draft.item, draft.quality, draft.supplierId);
    setLines((prev) => [
      ...prev,
      {
        product: draft.product,
        item: draft.item,
        quality: draft.quality,
        supplierId: draft.supplierId,
        purchaseId:
          stockLots.find(
            (l) => l.item === draft.item && l.quality === draft.quality && l.supplierId === draft.supplierId
          )?.purchaseId ?? undefined,
        qty: Number(draft.qty) || 1,
        rate: Math.round(price ?? (unitCost * 1.15)) || 0,
      },
    ]);
    setDraftState((d) => ({ ...d, qty: 1 }));
  };

  const resetDraft = () => setDraftState(freshDraft());
  const removeAll = () => setLines([]);

  return {
    customers,
    inventory,
    sourceRows,
    productsWithStock,
    itemsOf,
    qualitiesOf,
    sourcesOf,
    availOf,
    sourceUnits: sourceUnitOf,
    supplierName,
    unitOf,
    draft,
    setDraft,
    onDraftProduct,
    onDraftItem,
    onDraftQuality,
    draftAvail,
    draftUnit,
    draftPrice,
    draftOver,
    canAdd,
    addDraftItem,
    lines,
    setLine,
    removeLine,
    lineOver,
    resetDraft,
    removeAll,
  };
}