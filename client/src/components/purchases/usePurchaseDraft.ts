"use client";

import { useCallback, useMemo, useState } from "react";
import { useStore, type CreatePurchaseInput } from "@/lib/store";
import { productUsesCategories, scopedDefs } from "@/lib/catalogue";
import { validateAttributes } from "@/components/catalogue/AttributeFields";
import { fmtMoney } from "@/lib/format";
import { lineCharges, lineGoods } from "./purchase-draft-utils";

export interface PurchaseDraftPick {
  productId: string;
  categoryId: string;
  attrs: Record<string, string>;
  qty: number;
  rate: number;
  sellRate: number;
  loading: number;
  transport: number;
  labour: number;
  otherCost: number;
  paidToSupplier: number;
  lotNumber: string;
  heatNumber: string;
  batchNumber: string;
  warehouseId: string;
  locationId: string;
}

function emptyPick(productId: string, categoryId: string): PurchaseDraftPick {
  return {
    productId,
    categoryId,
    attrs: {},
    qty: 0,
    rate: 0,
    sellRate: 0,
    loading: 0,
    transport: 0,
    labour: 0,
    otherCost: 0,
    paidToSupplier: 0,
    lotNumber: "",
    heatNumber: "",
    batchNumber: "",
    warehouseId: "",
    locationId: "",
  };
}

export function usePurchaseDraft() {
  const {
    products,
    categories,
    attributeDefs,
    attributeOptions,
    warehouses,
    locations,
    ensureVariant,
  } = useStore();

  const activeProducts = useMemo(
    () => products.filter((p) => p.active !== false),
    [products],
  );

  const freshPick = useCallback((): PurchaseDraftPick => {
    const p = activeProducts[0];
    const uses = productUsesCategories(p);
    const cats = p && uses ? categories.filter((c) => c.productId === p.id && c.active) : [];
    return emptyPick(p?.id ?? "", cats[0]?.id ?? "");
  }, [activeProducts, categories]);

  const [pick, setPickState] = useState<PurchaseDraftPick>(() => emptyPick("", ""));

  const resetForm = useCallback(() => {
    setPickState(freshPick());
  }, [freshPick]);

  const setPick = (patch: Partial<PurchaseDraftPick>) =>
    setPickState((d) => ({ ...d, ...patch }));

  const product = activeProducts.find((p) => p.id === pick.productId) ?? activeProducts[0];
  const usesCats = productUsesCategories(product);
  const catsOfProduct = usesCats
    ? categories.filter((c) => c.productId === product?.id && c.active)
    : [];
  const category = usesCats
    ? categories.find((c) => c.id === pick.categoryId) ?? catsOfProduct[0]
    : undefined;

  const onProduct = (productId: string) => {
    const cats = categories.filter((c) => c.productId === productId && c.active);
    setPickState(emptyPick(productId, cats[0]?.id ?? ""));
  };

  const onCategory = (categoryId: string) =>
    setPickState((d) => ({ ...d, categoryId, attrs: {} }));

  const pickDefs = product
    ? scopedDefs(attributeDefs, product.id, usesCats ? category?.id : undefined).filter((d) => d.active)
    : [];

  const productUnit = product?.unit ?? "kg";
  const warehouse = warehouses.find((w) => w.id === pick.warehouseId && w.active);
  const whLocations = locations.filter((l) => l.warehouseId === pick.warehouseId && l.active);

  const goodsTotal = lineGoods(pick.qty, pick.rate);
  const chargesTotal = lineCharges(pick);
  const landedTotal = goodsTotal + chargesTotal;
  const landedPerUnit = pick.qty > 0.001 ? landedTotal / pick.qty : 0;
  const marginPerUnit = pick.sellRate > 0 ? pick.sellRate - landedPerUnit : 0;
  const dueToSupplier = Math.max(0, goodsTotal - pick.paidToSupplier);

  const payError =
    goodsTotal > 0.001 && pick.paidToSupplier > goodsTotal + 0.001
      ? `Paid to supplier (${fmtMoney(pick.paidToSupplier)}) cannot exceed goods total (${fmtMoney(goodsTotal)}).`
      : pick.paidToSupplier > 0.001 && goodsTotal < 0.001
        ? "Enter quantity and buying price before recording payment."
        : undefined;

  const attrErrors = validateAttributes(pickDefs, pick.attrs);
  const canSave =
    !!product &&
    !!pick.productId &&
    (!usesCats || !!category) &&
    pick.qty > 0.001 &&
    pick.rate >= 0 &&
    !Number.isNaN(pick.rate) &&
    Object.keys(attrErrors).length === 0 &&
    !payError;

  const buildCreateInput = async (
    date: string,
    supplierId: string,
  ): Promise<{ error: string } | { doc: CreatePurchaseInput }> => {
    if (!supplierId) return { error: "Pick the supplier you bought from." };
    if (!canSave || !product) return { error: "Complete product, quantity, and buying price." };
    const variant = await ensureVariant(product.id, usesCats ? category?.id : undefined, pick.attrs);
    return {
      doc: {
        date,
        supplierId,
        transport: Number(pick.transport) || 0,
        loading: Number(pick.loading) || 0,
        labour: Number(pick.labour) || 0,
        otherCost: Number(pick.otherCost) || 0,
        paid: Number(pick.paidToSupplier) || 0,
        lines: [
          {
            productId: product.id,
            variantId: variant.id,
            categoryId: usesCats ? category?.id : undefined,
            item: variant.shortName,
            attributeSnapshot: { ...variant.attributes },
            qty: Number(pick.qty),
            unit: productUnit,
            rate: Number(pick.rate),
            sellRate: pick.sellRate > 0 ? Number(pick.sellRate) : undefined,
            productName: product.name,
            lotNumber: pick.lotNumber.trim() || undefined,
            heatNumber: pick.heatNumber.trim() || undefined,
            batchNumber: pick.batchNumber.trim() || undefined,
            warehouseId: pick.warehouseId || undefined,
            locationId: pick.locationId || undefined,
          },
        ],
      },
    };
  };

  return {
    activeProducts,
    categories,
    attributeDefs,
    attributeOptions,
    warehouses,
    locations,
    product,
    usesCats,
    catsOfProduct,
    category,
    pickDefs,
    productUnit,
    warehouse,
    whLocations,
    pick,
    setPick,
    onProduct,
    onCategory,
    goodsTotal,
    chargesTotal,
    landedTotal,
    landedPerUnit,
    marginPerUnit,
    dueToSupplier,
    payError,
    canSave,
    resetForm,
    buildCreateInput,
  };
}

export type PurchaseDraftApi = ReturnType<typeof usePurchaseDraft>;
