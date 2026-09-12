"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { attrsValuesLine } from "@/lib/catalogue";
import type { AttributeDef } from "@/lib/types";

/* a line on the current sale */
export interface SaleDraftLine {
  categoryId?: string;
  variantId: string;
  item: string; // variant short name (mirror)
  snapshot?: Record<string, string>;
  unit: string;
  qty: number;
  rate: number;
  qualityName?: string; // quality name shown on the invoice (prefilled, editable)
  supplierId?: string; // set when a specific source lot is chosen
  purchaseId?: string; // exact lot, when chosen
}

export interface DraftPick {
  productId: string;
  categoryId: string;
  variantId: string;
  lotId: string; // "" = any lot of the variant (FIFO)
  qty: number;
}

export interface VariantPickRow {
  variantId: string;
  shortName: string;
  attrText: string;
  unit: string;
  stockQty: number;
  sellPrice?: number;
  landedAvg: number;
}

export interface LotOption {
  purchaseId: string;
  supplierId: string;
  label: string; // supplier + heat/lot + location
  remaining: number;
  unit: string;
  sellPrice?: number;
  landedPerUnit: number;
}

export function useSaleDraft() {
  const {
    customers,
    products,
    categories,
    attributeDefs,
    variants,
    suppliers,
    warehouses,
    locations,
    purchases,
    inventory,
    inventoryByVariant,
    stockLots,
  } = useStore();

  const supplierName = (id?: string) => suppliers.find((s) => s.id === id)?.name ?? "";
  const locationName = (id?: string) => locations.find((l) => l.id === id)?.name;
  const warehouseName = (id?: string) => warehouses.find((w) => w.id === id)?.name;

  const defsByCategory = useMemo(() => {
    const m: Record<string, AttributeDef[]> = {};
    for (const d of attributeDefs.filter((x) => x.active)) (m[d.categoryId] ??= []).push(d);
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.sortOrder - b.sortOrder);
    return m;
  }, [attributeDefs]);

  const varById = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const prodById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  /* ---- what's sellable (has stock) ---- */
  const stocked = useMemo(
    () => inventoryByVariant.filter((r) => r.stockQty > 0.000001),
    [inventoryByVariant]
  );

  const attrTextOf = (variantId: string, snapshot?: Record<string, string>) =>
    attrsValuesLine(defsByCategory[varById.get(variantId)?.categoryId ?? ""] ?? [], snapshot);

  const variantRowsOf = (categoryId: string): VariantPickRow[] =>
    stocked
      .filter((r) => r.categoryId === categoryId)
      .map((r) => ({
        variantId: r.variantId,
        shortName: r.shortName,
        attrText: attrTextOf(r.variantId, r.attributeSnapshot),
        unit: r.unit,
        stockQty: r.stockQty,
        landedAvg: r.landedAvg,
        sellPrice: r.sellRate,
      }));

  const lotsOf = (variantId: string): LotOption[] =>
    stockLots
      .filter((l) => l.variantId === variantId && l.remainingQty > 0.000001)
      .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))
      .map((l) => ({
        purchaseId: l.purchaseId,
        supplierId: l.supplierId,
        label: [
          supplierName(l.supplierId),
          l.lotNumber || l.heatNumber || l.batchNumber,
          [warehouseName(l.warehouseId), locationName(l.locationId)].filter(Boolean).join(" / "),
        ]
          .filter(Boolean)
          .join(" · "),
        remaining: l.remainingQty,
        unit: l.unit,
        sellPrice: l.sellPrice,
        landedPerUnit: l.landedPerUnit,
      }));

  const stockTotalOf = (variantId: string) =>
    inventoryByVariant.find((r) => r.variantId === variantId)?.stockQty ?? 0;

  /* ---- draft pick ---- */
  const productsWithStock = useMemo(() => {
    const ids = new Set(stocked.map((r) => r.productId).filter(Boolean));
    return products.filter((p) => ids.has(p.id) && p.active !== false);
  }, [stocked, products]);

  const categoriesOfProduct = (productId: string) => {
    const catIds = new Set(stocked.filter((r) => r.productId === productId).map((r) => r.categoryId).filter(Boolean));
    return categories.filter((c) => catIds.has(c.id) && c.productId === productId && c.active !== false);
  };

  const freshPick = (): DraftPick => {
    const p = productsWithStock[0];
    const c = p ? categoriesOfProduct(p.id)[0] : undefined;
    const v = c ? variantRowsOf(c.id)[0] : undefined;
    return { productId: p?.id ?? "", categoryId: c?.id ?? "", variantId: v?.variantId ?? "", lotId: "", qty: 1 };
  };

  const [pick, setPickState] = useState<DraftPick>(freshPick);
  const setPick = (patch: Partial<DraftPick>) => setPickState((d) => ({ ...d, ...patch }));

  const onProduct = (productId: string) => {
    const c = categoriesOfProduct(productId)[0];
    const v = c ? variantRowsOf(c.id)[0] : undefined;
    setPickState({ productId, categoryId: c?.id ?? "", variantId: v?.variantId ?? "", lotId: "", qty: 1 });
  };
  const onCategory = (categoryId: string) => {
    const v = variantRowsOf(categoryId)[0];
    setPickState((d) => ({ ...d, categoryId, variantId: v?.variantId ?? "", lotId: "", qty: 1 }));
  };
  const onVariant = (variantId: string) =>
    setPickState((d) => ({ ...d, variantId, lotId: "", qty: 1 }));

  const pickVariant = varById.get(pick.variantId) ?? null;
  const pickCategory = pickVariant ? catById.get(pickVariant.categoryId) : null;
  const pickRow = stocked.find((r) => r.variantId === pick.variantId) ?? null;
  const pickLots = pick.variantId ? lotsOf(pick.variantId) : [];
  const pickLot = pickLots.find((l) => l.purchaseId === pick.lotId);

  /* ---- added lines ---- */
  const [lines, setLines] = useState<SaleDraftLine[]>([]);

  const draftUnit = pickRow?.unit ?? "";
  /* stock left for the current pick (minus what's already on the invoice) */
  const draftAvail = (() => {
    if (!pick.variantId) return 0;
    const used = pick.lotId
      ? lines.filter((l) => l.purchaseId === pick.lotId).reduce((a, l) => a + (Number(l.qty) || 0), 0)
      : lines.filter((l) => l.variantId === pick.variantId).reduce((a, l) => a + (Number(l.qty) || 0), 0);
    const total = pickLot ? pickLot.remaining : stockTotalOf(pick.variantId);
    return Math.max(0, total - used);
  })();
  const draftOver = (Number(pick.qty) || 0) > draftAvail;
  const draftPrice = pickLot?.sellPrice ?? pickLots.find((l) => l.sellPrice)?.sellPrice ?? pickRow?.sellRate;
  const draftLanded = pickLot?.landedPerUnit ?? pickRow?.landedAvg ?? 0;
  const canAdd = !!pick.variantId && !draftOver && (Number(pick.qty) || 0) > 0;

  const setLine = (i: number, patch: Partial<SaleDraftLine>) =>
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, j) => j !== i));

  const addDraftItem = () => {
    if (!canAdd || !pickVariant) return;
    const source = pickLot ?? pickLots[0];
    // prefill the quality name from the source lot's purchase quality,
    // falling back to the variant's grade/quality attribute
    const sourcePurchase = source
      ? purchases.find((p) => p.id === source.purchaseId)
      : undefined;
    const gradeAttr = Object.entries(pickVariant.attributes ?? {}).find(([k]) =>
      /grade|quality/i.test(k)
    )?.[1];
    setLines((prev) => [
      ...prev,
      {
        categoryId: pickVariant.categoryId,
        variantId: pickVariant.id,
        item: pickVariant.shortName,
        snapshot: pickVariant.attributes,
        unit: draftUnit,
        qty: Number(pick.qty) || 1,
        rate: Math.round(draftPrice ?? (draftLanded * 1.15)) || 0,
        qualityName: sourcePurchase?.quality || gradeAttr || undefined,
        // explicit lot only when the operator picks one; otherwise leave unset
        // so the store consumes FIFO across the variant's lots
        supplierId: pick.lotId ? source?.supplierId : undefined,
        purchaseId: pick.lotId ? source?.purchaseId : undefined,
      },
    ]);
    setPickState((d) => ({ ...d, qty: 1 }));
  };

  const unitOf = (item: string) => inventory.find((r) => r.item === item)?.unit ?? "";
  const lineOver = (l: SaleDraftLine) => {
    const used = lines
      .filter((ol) => ol !== l && ol.variantId === l.variantId && (!l.purchaseId || ol.purchaseId === l.purchaseId))
      .reduce((a, ol) => a + (Number(ol.qty) || 0), 0);
    const avail = l.purchaseId
      ? lotsOf(l.variantId).find((x) => x.purchaseId === l.purchaseId)?.remaining ?? 0
      : stockTotalOf(l.variantId);
    return (Number(l.qty) || 0) > avail - used;
  };

  const resetDraft = () => setPickState(freshPick());
  const removeAll = () => setLines([]);

  return {
    customers,
    productsWithStock,
    categoriesOfProduct,
    variantRowsOf,
    lotsOf,
    supplierName,
    defsByCategory,
    varById,
    catById,
    prodById,
    attrTextOf,
    unitOf,
    hasStock: stocked.length > 0,
    pick,
    setPick,
    onProduct,
    onCategory,
    onVariant,
    pickCategory,
    pickVariant,
    draftUnit,
    draftAvail,
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

export type SaleDraftApi = ReturnType<typeof useSaleDraft>;
