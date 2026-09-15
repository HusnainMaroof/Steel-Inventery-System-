"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { attrsValuesLine, identityKey, productUsesCategories, resolveDefs, scopedDefs, variantKey } from "@/lib/catalogue";

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
  attrs: Record<string, string>;
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
    attributeOptions,
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

  const varById = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const prodById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  /* ---- what's sellable (has stock) ---- */
  const stocked = useMemo(
    () => inventoryByVariant.filter((r) => r.stockQty > 0.000001),
    [inventoryByVariant]
  );

  const defsOfVariant = (variantId: string, snapshot?: Record<string, string>) => {
    const v = varById.get(variantId);
    return resolveDefs(attributeDefs, {
      productId: v?.productId,
      categoryId: v?.categoryId,
      snapshot,
    });
  };

  const attrTextOf = (variantId: string, snapshot?: Record<string, string>) =>
    attrsValuesLine(defsOfVariant(variantId, snapshot), snapshot);

  const variantRowsOf = (productId: string, categoryId?: string): VariantPickRow[] =>
    stocked
      .filter((r) => r.productId === productId && (!categoryId || r.categoryId === categoryId))
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
    const prod = prodById.get(productId);
    if (!productUsesCategories(prod)) return [];
    const catIds = new Set(stocked.filter((r) => r.productId === productId).map((r) => r.categoryId).filter(Boolean));
    return categories.filter((c) => catIds.has(c.id) && c.productId === productId && c.active !== false);
  };

  const attrsOfFirstStocked = (productId: string, categoryId?: string): Record<string, string> => {
    const row = stocked.find((r) => r.productId === productId && (!categoryId || r.categoryId === categoryId));
    if (row?.attributeSnapshot) return { ...row.attributeSnapshot };
    const v = row ? varById.get(row.variantId) : undefined;
    return v?.attributes ? { ...v.attributes } : {};
  };

  const matchVariant = (productId: string, categoryId: string | undefined, attrs: Record<string, string>) => {
    const clean: Record<string, string> = {};
    for (const [k, val] of Object.entries(attrs))
      if (val !== undefined && val.trim() !== "") clean[k] = val.trim();
    const defs = scopedDefs(attributeDefs, productId, categoryId);
    const scopeId = categoryId || productId;
    const ident = identityKey(scopeId, clean, defs, attributeOptions);
    const legacy = variantKey(scopeId, clean);
    const ofProduct = (v: { productId?: string; categoryId?: string }) => {
      if (v.productId === productId) return true;
      const cat = v.categoryId ? catById.get(v.categoryId) : undefined;
      return cat?.productId === productId;
    };
    return (
      variants.find(
        (v) =>
          ofProduct(v) &&
          (v.identityKey === ident || v.key === ident || v.key === legacy)
      ) ??
      variants.find(
        (v) =>
          ofProduct(v) &&
          (!categoryId || v.categoryId === categoryId) &&
          Object.keys(clean).every((k) => (v.attributes[k] ?? "") === clean[k])
      ) ??
      null
    );
  };

  const freshPick = (): DraftPick => {
    const p = productsWithStock[0];
    const uses = productUsesCategories(p);
    const c = uses && p ? categoriesOfProduct(p.id)[0] : undefined;
    return {
      productId: p?.id ?? "",
      categoryId: c?.id ?? "",
      attrs: p ? attrsOfFirstStocked(p.id, c?.id) : {},
      lotId: "",
      qty: 1,
    };
  };

  const [pick, setPickState] = useState<DraftPick>(freshPick);
  const setPick = (patch: Partial<DraftPick>) => setPickState((d) => ({ ...d, ...patch }));

  const onProduct = (productId: string) => {
    const p = prodById.get(productId);
    const uses = productUsesCategories(p);
    const c = uses ? categoriesOfProduct(productId)[0] : undefined;
    setPickState({
      productId,
      categoryId: c?.id ?? "",
      attrs: attrsOfFirstStocked(productId, c?.id),
      lotId: "",
      qty: 1,
    });
  };
  const onCategory = (categoryId: string) => {
    setPickState((d) => ({
      ...d,
      categoryId,
      attrs: attrsOfFirstStocked(d.productId, categoryId),
      lotId: "",
      qty: 1,
    }));
  };
  const onAttrs = (attrs: Record<string, string>) =>
    setPickState((d) => ({ ...d, attrs, lotId: "", qty: d.qty }));

  const pickProduct = pick.productId ? prodById.get(pick.productId) ?? null : null;
  const pickUsesCats = productUsesCategories(pickProduct);
  const pickVariant = matchVariant(pick.productId, pickUsesCats ? pick.categoryId || undefined : undefined, pick.attrs);
  const pickCategory = pickUsesCats && pick.categoryId ? catById.get(pick.categoryId) ?? null : null;
  const pickRow = pickVariant ? stocked.find((r) => r.variantId === pickVariant.id) ?? null : null;
  const pickLots = pickVariant ? lotsOf(pickVariant.id) : [];
  const pickLot = pickLots.find((l) => l.purchaseId === pick.lotId);
  const pickDefs = pick.productId
    ? scopedDefs(attributeDefs, pick.productId, pickUsesCats ? pick.categoryId || undefined : undefined).filter((d) => d.active)
    : [];

  /* ---- added lines ---- */
  const [lines, setLines] = useState<SaleDraftLine[]>([]);

  const draftUnit = pickRow?.unit ?? "";
  /* stock left for the current pick (minus what's already on the invoice) */
  const draftAvail = (() => {
    if (!pickVariant) return 0;
    const used = pick.lotId
      ? lines.filter((l) => l.purchaseId === pick.lotId).reduce((a, l) => a + (Number(l.qty) || 0), 0)
      : lines.filter((l) => l.variantId === pickVariant.id).reduce((a, l) => a + (Number(l.qty) || 0), 0);
    const total = pickLot ? pickLot.remaining : stockTotalOf(pickVariant.id);
    return Math.max(0, total - used);
  })();
  const draftOver = (Number(pick.qty) || 0) > draftAvail;
  const draftPrice = pickLot?.sellPrice ?? pickLots.find((l) => l.sellPrice)?.sellPrice ?? pickRow?.sellRate;
  const draftLanded = pickLot?.landedPerUnit ?? pickRow?.landedAvg ?? 0;
  const canAdd = !!pickVariant && !!pickRow && !draftOver && (Number(pick.qty) || 0) > 0;

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
        categoryId: pickUsesCats ? pickVariant.categoryId : undefined,
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
    defsOfVariant,
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
    onAttrs,
    pickProduct,
    pickUsesCats,
    pickCategory,
    pickVariant,
    pickDefs,
    attributeOptions,
    notInStock: !!pick.productId && !!pickVariant === false,
    noStockForCombo: !!pickVariant && !pickRow,
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
