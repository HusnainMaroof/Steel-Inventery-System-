"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AttributeDef,
  AttributeOption,
  Customer,
  Expense,
  InventoryRow,
  Payment,
  Product,
  ProductCategory,
  ProductItem,
  Purchase,
  Quality,
  Sale,
  StockLot,
  StockMovementView,
  Supplier,
  Variant,
  Warehouse,
  WarehouseLocation,
} from "./types";
import { BUSINESS_ID } from "./types";
import { defaultShortName, variantKey } from "./catalogue";
import { seedInitialState } from "./seed";

export const purchaseTotal = (p: Purchase) =>
  p.qty * p.rate + p.transport + p.otherCost;

// what we owe the MILL: steel amount only — transport & other costs are on us
export const steelAmount = (p: Purchase) => p.qty * p.rate;

/* subtotal = goods total before discount & tax */
export const saleTotal = (s: Sale) =>
  s.lines.reduce((sum, l) => sum + l.qty * l.rate, 0);

/* invoice-wide money helpers — single source of truth for every surface */
export const saleDiscount = (s: Sale) =>
  saleTotal(s) * ((s.discountPct ?? 0) / 100);
export const saleTaxable = (s: Sale) => saleTotal(s) - saleDiscount(s);
export const saleTax = (s: Sale) => saleTaxable(s) * ((s.taxPct ?? 0) / 100);
export const saleGrandTotal = (s: Sale) => saleTaxable(s) + saleTax(s);
export type InvoiceStatus = "paid" | "unpaid";

export const invoiceStatus = (paid: number, total: number): InvoiceStatus =>
  paid >= total - 0.001 ? "paid" : "unpaid";

export interface DashboardStats {
  stockQty: number;
  stockValue: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  customerDues: number;
  supplierDues: number;
}

/* stock grouped at variant level — the unit a business actually stocks/sells */
export interface VariantStockRow {
  variantId: string; // "item:<name>" for pre-dynamic records with no variant
  legacyItem?: string; // legacy item mirror when no variant exists
  productId?: string;
  product?: string; // product name
  categoryId?: string;
  category?: string; // category name
  shortName: string; // variant short name (or legacy item name)
  attributeSnapshot?: Record<string, string>;
  unit: string;
  purchasedQty: number;
  soldQty: number;
  stockQty: number;
  totalCost: number;
  landedAvg: number;
  stockValue: number;
  avgSellRate: number;
  sellRate?: number;
}

interface Store {
  suppliers: Supplier[];
  customers: Customer[];
  purchases: Purchase[];
  sales: Sale[];
  payments: Payment[];
  expenses: Expense[];
  products: Product[];
  productItems: ProductItem[];
  qualities: Quality[];
  // dynamic catalogue configuration
  categories: ProductCategory[];
  attributeDefs: AttributeDef[];
  attributeOptions: AttributeOption[];
  variants: Variant[];
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  inventory: InventoryRow[];
  inventoryByVariant: VariantStockRow[]; // stock grouped per variant
  stockMovements: StockMovementView[]; // derived + in / − out journal
  byItem: Record<string, number>; // item -> weighted avg landed cost
  byItemSource: Record<string, Record<string, number>>; // item -> supplierId -> landed cost
  inventoryBySource: InventoryRow[]; // per item+source rows
  stockLots: StockLot[]; // remaining stock per purchase lot (source view)
  lineUnitCost: (saleId: string, lineIdx: number) => number; // landed cost of the stock a line consumed
  salePaid: (saleId: string) => number; // amount already paid toward a specific invoice
  customerBalance: (id: string) => number; // + = owes us, - = advance
  supplierBalance: (id: string) => number; // + = we owe
  stats: DashboardStats;
  addPurchase: (p: Omit<Purchase, "id">) => void;
  updatePurchase: (id: string, patch: Partial<Purchase>) => void;
  deletePurchase: (id: string) => void;
  addSale: (s: Omit<Sale, "id" | "invoiceNo" | "createdAt">) => string;
  addPayment: (p: Omit<Payment, "id">) => void;
  addCustomer: (c: Omit<Customer, "id">) => string;
  addSupplier: (s: Omit<Supplier, "id">) => void;
  addExpense: (e: Omit<Expense, "id">) => void;
  addProduct: (name: string, unit: string) => string;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  addProductItem: (productId: string, name: string) => void;
  addQuality: (productId: string, name: string, specOnly?: boolean) => void;
  deleteProduct: (id: string) => void;
  deleteProductItem: (id: string) => void;
  deleteQuality: (id: string) => void;
  // --- dynamic catalogue configuration ---
  addCategory: (productId: string, name: string) => string;
  renameCategory: (id: string, name: string) => void;
  setCategoryActive: (id: string, active: boolean) => void;
  addAttribute: (
    categoryId: string,
    def: { name: string; type: AttributeDef["type"]; required: boolean; unit?: string; options?: string[] }
  ) => string; // returns the new def id (also creates its options)
  patchAttribute: (id: string, patch: Partial<AttributeDef>) => void;
  addOption: (attributeDefId: string, label: string) => void;
  patchOption: (id: string, patch: Partial<AttributeOption>) => void;
  addWarehouse: (name: string) => void;
  renameWarehouse: (id: string, name: string) => void;
  setWarehouseActive: (id: string, active: boolean) => void;
  addLocation: (warehouseId: string, name: string) => void;
  renameLocation: (id: string, name: string) => void;
  setLocationActive: (id: string, active: boolean) => void;
  /** find-or-create the variant for an attribute combination (deduped by key) */
  ensureVariant: (categoryId: string, attributes: Record<string, string>, shortName?: string) => Variant;
  setVariantShortName: (id: string, shortName: string) => void;
  setVariantActive: (id: string, active: boolean) => void;
  deleteVariant: (id: string) => void; // only safe when no transaction references it
  deleteCustomer: (id: string) => void;
  deleteSupplier: (id: string) => void;
  deleteInventoryItem: (item: string) => void;
  hideInventoryItem: (item: string) => void; // removes a sold-out row from the inventory list only — records & numbers stay
  deleteInventoryVariant: (variantId: string) => void; // cascade: that variant's purchases + sales + their payments
  hideInventoryVariant: (variantId: string) => void; // cosmetic removal of a sold-out variant row
}

const StoreCtx = createContext<Store | null>(null);

let seq = 1000;
const nextId = () => `x${seq++}`;

// seed ids are `prod-*`, `item-*`, `qual-*`; records created in-app get x1000, x1001, …
const INITIAL = seedInitialState;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL.suppliers);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL.customers);
  const [purchases, setPurchases] = useState<Purchase[]>(INITIAL.purchases);
  const [sales, setSales] = useState<Sale[]>(INITIAL.sales);
  const [payments, setPayments] = useState<Payment[]>(INITIAL.payments ?? []);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL.expenses ?? []);
  const [products, setProducts] = useState<Product[]>(INITIAL.products);
  const [productItems, setProductItems] = useState<ProductItem[]>(INITIAL.productItems);
  const [qualities, setQualities] = useState<Quality[]>(INITIAL.qualities);
  const [categories, setCategories] = useState<ProductCategory[]>(INITIAL.categories);
  const [attributeDefs, setAttributeDefs] = useState<AttributeDef[]>(INITIAL.attributeDefs);
  const [attributeOptions, setAttributeOptions] = useState<AttributeOption[]>(INITIAL.attributeOptions);
  const [variants, setVariants] = useState<Variant[]>(INITIAL.variants);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(INITIAL.warehouses);
  const [locations, setLocations] = useState<WarehouseLocation[]>(INITIAL.locations);
  const [hiddenItems, setHiddenItems] = useState<string[]>([]);
  const [hiddenVariants, setHiddenVariants] = useState<string[]>([]);

  const {
    inventory,
    byItem,
    byItemSource,
    stockLots,
    inventoryBySource,
    lineUnitCost,
  } = useMemo(() => {
    const map: Record<
      string,
      { pq: number; cost: number; sq: number; rev: number; sr: number; srq: number }
    > = {};
    for (const p of purchases) {
      const m = (map[p.item] ??= { pq: 0, cost: 0, sq: 0, rev: 0, sr: 0, srq: 0 });
      m.pq += p.qty;
      m.cost += purchaseTotal(p);
      if (p.sellRate) {
        m.sr += p.qty * p.sellRate;
        m.srq += p.qty;
      }
    }
    for (const s of sales) {
      for (const l of s.lines) {
        const m = (map[l.item] ??= { pq: 0, cost: 0, sq: 0, rev: 0, sr: 0, srq: 0 });
        m.sq += l.qty;
        m.rev += l.qty * l.rate;
      }
    }
    const rows: InventoryRow[] = [];
    const itemMap: Record<string, number> = {};
    // product name -> unit, so each item's unit comes from its product definition
    const productUnit: Record<string, string> = {};
    for (const prod of products) productUnit[prod.name] = prod.unit;
    // meta per item: product / spec / quality come from purchases; unit comes from the product
    const meta: Record<string, { product?: string; spec?: string; quality?: string; unit?: string }> = {};
    for (const p of purchases) {
      meta[p.item] = {
        product: p.product || meta[p.item]?.product,
        spec: p.spec || meta[p.item]?.spec,
        quality: p.quality || meta[p.item]?.quality,
        unit:
          (p.product && productUnit[p.product]) ||
          meta[p.item]?.unit ||
          p.unit ||
          "",
      };
    }
    for (const [item, m] of Object.entries(map)) {
      const landedAvg = m.pq > 0 ? m.cost / m.pq : 0;
      const stockQty = m.pq - m.sq;
      rows.push({
        item,
        ...meta[item],
        purchasedQty: m.pq,
        soldQty: m.sq,
        stockQty,
        totalCost: m.cost,
        landedAvg,
        stockValue: stockQty * landedAvg,
        avgSellRate: m.sq > 0 ? m.rev / m.sq : 0,
        sellRate: m.srq > 0 ? m.sr / m.srq : 0,
      });
      itemMap[item] = landedAvg;
    }
    // fully-sold rows that were cleaned off the inventory list stay hidden
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].stockQty <= 0.000001 && hiddenItems.includes(rows[i].item))
        rows.splice(i, 1);
    }
    rows.sort((a, b) => a.item.localeCompare(b.item));

    /* ---- per-lot stock allocation (FIFO, oldest purchase first) ---- */
    type Lot = { p: Purchase; remaining: number; landed: number };
    const supplierName = (id: string) =>
      suppliers.find((s) => s.id === id)?.name ?? "—";
    const lots: Lot[] = [...purchases]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({
        p,
        remaining: p.qty,
        landed: p.qty > 0 ? purchaseTotal(p) / p.qty : 0,
      }));

    // consume qty from eligible lots (oldest first); returns weighted landed
    // cost per unit actually consumed, or -1 if nothing was consumed
    const consume = (elig: Lot[], qty: number): number => {
      let left = qty;
      let total = 0;
      for (const lot of elig) {
        if (left <= 0) break;
        if (lot.remaining <= 0.000001) continue;
        const take = Math.min(lot.remaining, left);
        total += take * lot.landed;
        lot.remaining -= take;
        left -= take;
      }
      const taken = qty - left;
      return taken > 0 ? total / taken : -1;
    };

    // per sale line, the landed unit cost of the stock it consumed
    const lineCostRec: Record<string, number> = {};
    const lineKey = (saleId: string, i: number) => `${saleId}:${i}`;
    const fallback = (item: string) => itemMap[item] ?? 0;
    // process oldest sales first so FIFO allocation is meaningful
    for (const s of [...sales].reverse()) {
      for (const [i, l] of s.lines.entries()) {
        let unit: number;
        if (l.purchaseId) {
          const lot = lots.find((x) => x.p.id === l.purchaseId);
          if (lot && lot.remaining >= l.qty) {
            lot.remaining -= l.qty;
            unit = lot.landed;
          } else if (lot) {
            const c = consume([lot], l.qty);
            unit = c >= 0 ? c : fallback(l.item);
          } else {
            unit = fallback(l.item);
          }
        } else {
          let elig = lots.filter((x) => x.p.item === l.item);
          if (l.supplierId) elig = elig.filter((x) => x.p.supplierId === l.supplierId);
          // dynamic records: consume only same-variant stock (FIFO within it)
          if (l.variantId) elig = elig.filter((x) => x.p.variantId === l.variantId);
          const c = consume(elig, l.qty);
          unit = c >= 0 ? c : fallback(l.item);
        }
        lineCostRec[lineKey(s.id, i)] = unit;
      }
    }

    /* ---- per-source rows from the remaining lots ---- */
    const srcAgg: Record<
      string,
      InventoryRow & { pq: number; cost: number; remain: number; remainVal: number; sellW: number; sellQ: number }
    > = {};
    const srcKey = (item: string, spec: string | undefined, supplierId: string) =>
      `${item}\u0000${spec ?? ""}\u0000${supplierId}`;
    // purchased totals per item+spec+source
    for (const p of purchases) {
      const k = srcKey(p.item, p.spec, p.supplierId);
      const a = (srcAgg[k] ??= {
        item: p.item,
        product: meta[p.item]?.product,
        spec: p.spec,
        quality: p.quality,
        supplierId: p.supplierId,
        purchasedQty: 0,
        soldQty: 0,
        stockQty: 0,
        totalCost: 0,
        landedAvg: 0,
        stockValue: 0,
        avgSellRate: 0,
        pq: 0,
        cost: 0,
        remain: 0,
        remainVal: 0,
        sellW: 0,
        sellQ: 0,
      });
      a.pq += p.qty;
      a.cost += purchaseTotal(p);
      if (p.spec) a.spec = p.spec;
      if (p.quality) a.quality = p.quality;
    }
    // remaining stock per item+spec+source (and the selling price of that remaining stock)
    for (const lot of lots) {
      if (lot.remaining <= 0.000001) continue;
      const a = srcAgg[srcKey(lot.p.item, lot.p.spec, lot.p.supplierId)];
      if (a) {
        a.remain += lot.remaining;
        a.remainVal += lot.remaining * lot.landed;
        if (lot.p.sellRate) {
          a.sellW += lot.remaining * lot.p.sellRate;
          a.sellQ += lot.remaining;
        }
      }
    }
    const inventoryBySource: InventoryRow[] = Object.values(srcAgg).map((a) => {
      const landedAvg = a.pq > 0 ? a.cost / a.pq : 0;
      const stockQty = a.remain;
      const avgSellRate = a.sellQ > 0 ? a.sellW / a.sellQ : 0;
      return {
        item: a.item,
        ...meta[a.item],
        spec: a.spec,
        quality: a.quality,
        supplierId: a.supplierId,
        purchasedQty: a.pq,
        soldQty: a.pq - stockQty,
        stockQty,
        totalCost: a.cost,
        landedAvg,
        stockValue: a.remainVal,
        avgSellRate: 0,
        sellRate: avgSellRate,
      };
    });
    inventoryBySource.sort((a, b) =>
      (a.product ?? a.item).localeCompare(b.product ?? b.item) || a.item.localeCompare(b.item)
    );

    const byItemSource: Record<string, Record<string, number>> = {};
    for (const r of inventoryBySource) {
      if (!r.supplierId) continue;
      (byItemSource[r.item] ??= {})[r.supplierId] = r.landedAvg;
    }

    const stockLots: StockLot[] = lots
      .filter((l) => l.remaining > 0.000001)
      .map((l) => ({
        purchaseId: l.p.id,
        item: l.p.item,
        product: l.p.product,
        spec: l.p.spec,
        quality: l.p.quality,
        categoryId: l.p.categoryId,
        variantId: l.p.variantId,
        attributeSnapshot: l.p.attributeSnapshot,
        lotNumber: l.p.lotNumber,
        heatNumber: l.p.heatNumber,
        batchNumber: l.p.batchNumber,
        warehouseId: l.p.warehouseId,
        locationId: l.p.locationId,
        supplierId: l.p.supplierId,
        unit: l.p.unit || (l.p.product && productUnit[l.p.product]) || "",
        remainingQty: l.remaining,
        landedPerUnit: l.landed,
        sellPrice: l.p.sellRate || undefined,
        purchasedAt: l.p.date,
        supplierName: supplierName(l.p.supplierId),
      }))
      .sort((a, b) => a.item.localeCompare(b.item) || a.purchasedAt.localeCompare(b.purchasedAt));

    const lineUnitCost = (saleId: string, idx: number) =>
      lineCostRec[lineKey(saleId, idx)] ?? 0;

    return { inventory: rows, byItem: itemMap, byItemSource, stockLots, inventoryBySource, lineUnitCost };
  }, [purchases, sales, products, suppliers, hiddenItems]);

  /* ---- variant-level stock (the unit a business stocks/sells) ----
     Same derivation rule (purchases − sales), grouped by variant instead of
     the legacy item string. Records without a variant keep an "item:" key so
     nothing is lost. */
  const inventoryByVariant = useMemo<VariantStockRow[]>(() => {
    const productById = new Map(products.map((p) => [p.id, p]));
    const catById = new Map(categories.map((c) => [c.id, c]));
    const varById = new Map(variants.map((v) => [v.id, v]));
    type Acc = {
      variantId: string;
      legacyItem?: string;
      categoryId?: string;
      snapshot?: Record<string, string>;
      unit: string;
      pq: number; cost: number; sq: number; rev: number; sr: number; srq: number;
    };
    const acc: Record<string, Acc> = {};
    const productNameOfItem: Record<string, string> = {};
    for (const p of purchases) if (p.product) productNameOfItem[p.item] = p.product;
    const ensure = (variantId: string, from: { item: string; categoryId?: string; snapshot?: Record<string, string>; unit?: string }) => {
      acc[variantId] ??= {
        variantId,
        legacyItem: variantId.startsWith("item:") ? from.item : undefined,
        categoryId: from.categoryId,
        snapshot: from.snapshot,
        unit: from.unit ?? "",
        pq: 0, cost: 0, sq: 0, rev: 0, sr: 0, srq: 0,
      };
      return acc[variantId];
    };
    for (const p of purchases) {
      const k = p.variantId ?? `item:${p.item}`;
      const a = ensure(k, { item: p.item, categoryId: p.categoryId, snapshot: p.attributeSnapshot, unit: p.unit });
      a.pq += p.qty;
      a.cost += purchaseTotal(p);
      if (p.sellRate) { a.sr += p.qty * p.sellRate; a.srq += p.qty; }
    }
    for (const s of sales)
      for (const l of s.lines) {
        const k = l.variantId ?? `item:${l.item}`;
        const a = ensure(k, { item: l.item, categoryId: l.categoryId, snapshot: l.attributeSnapshot, unit: l.unit });
        a.sq += l.qty;
        a.rev += l.qty * l.rate;
      }
    const rows: VariantStockRow[] = Object.values(acc).map((a) => {
      const v = a.variantId.startsWith("item:") ? undefined : varById.get(a.variantId);
      const cat = v ? catById.get(v.categoryId) : a.categoryId ? catById.get(a.categoryId) : undefined;
      const prod = cat ? productById.get(cat.productId) : undefined;
      const landedAvg = a.pq > 0 ? a.cost / a.pq : 0;
      const stockQty = a.pq - a.sq;
      return {
        variantId: a.variantId,
        legacyItem: a.legacyItem,
        productId: prod?.id,
        product: prod?.name ?? (a.legacyItem ? productNameOfItem[a.legacyItem] : undefined),
        categoryId: cat?.id,
        category: cat?.name,
        shortName: v?.shortName ?? a.legacyItem ?? a.variantId,
        attributeSnapshot: a.snapshot,
        unit: (prod?.unit ?? a.unit) || "kg",
        purchasedQty: a.pq,
        soldQty: a.sq,
        stockQty,
        totalCost: a.cost,
        landedAvg,
        stockValue: stockQty * landedAvg,
        avgSellRate: a.sq > 0 ? a.rev / a.sq : 0,
        sellRate: a.srq > 0 ? a.sr / a.srq : undefined,
      };
    });
    rows.sort(
      (a, b) =>
        (a.product ?? "").localeCompare(b.product ?? "") ||
        (a.category ?? "").localeCompare(b.category ?? "") ||
        a.shortName.localeCompare(b.shortName)
    );
    // sold-out rows that were cleaned off the inventory list stay hidden
    for (let i = rows.length - 1; i >= 0; i--)
      if (rows[i].stockQty <= 0.000001 && hiddenVariants.includes(rows[i].variantId))
        rows.splice(i, 1);
    return rows;
  }, [purchases, sales, products, categories, variants, hiddenVariants]);

  /* ---- stock movements: a derived +/− journal of every stock change.
     Purchases and sales stay the authoritative records, so this projection
     can never drift from the ledger. */
  const stockMovements = useMemo<StockMovementView[]>(() => {
    const productById = new Map(products.map((p) => [p.id, p]));
    const catById = new Map(categories.map((c) => [c.id, c]));
    const varById = new Map(variants.map((v) => [v.id, v]));
    const productNameOfItem: Record<string, string> = {};
    for (const p of purchases) if (p.product) productNameOfItem[p.item] = p.product;
    const mv: StockMovementView[] = [];
    const resolve = (l: { variantId?: string; categoryId?: string; item: string }) => {
      const v = l.variantId ? varById.get(l.variantId) : undefined;
      const cat = v ? catById.get(v.categoryId) : l.categoryId ? catById.get(l.categoryId) : undefined;
      const prod = cat ? productById.get(cat.productId) : undefined;
      return {
        productId: prod?.id,
        categoryId: cat?.id ?? l.categoryId,
        variantId: l.variantId,
        productName: prod?.name ?? productNameOfItem[l.item],
      };
    };
    for (const p of purchases) {
      const r = resolve({ variantId: p.variantId, categoryId: p.categoryId, item: p.item });
      mv.push({
        id: `mv-p-${p.id}`,
        type: "PURCHASE_RECEIPT",
        date: p.date,
        productId: r.productId,
        categoryId: r.categoryId,
        variantId: r.variantId,
        attributeSnapshot: p.attributeSnapshot,
        unit: p.unit,
        qty: p.qty,
        purchaseId: p.id,
        supplierId: p.supplierId,
        warehouseId: p.warehouseId,
        locationId: p.locationId,
        refLabel: [p.lotNumber, p.heatNumber, p.batchNumber].filter(Boolean).join(" / ") || undefined,
      });
    }
    for (const s of sales)
      s.lines.forEach((l, i) => {
        const r = resolve({ variantId: l.variantId, categoryId: l.categoryId, item: l.item });
        mv.push({
          id: `mv-s-${s.id}-${i}`,
          type: "SALE",
          date: s.date,
          productId: r.productId,
          categoryId: r.categoryId,
          variantId: l.variantId,
          attributeSnapshot: l.attributeSnapshot,
          unit: l.unit,
          qty: -l.qty,
          saleId: s.id,
          saleLineIndex: i,
          supplierId: l.supplierId,
          refLabel: s.invoiceNo,
        });
      });
    return mv.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  }, [purchases, sales, products, categories, variants]);

  /* per-invoice allocation: explicit payments settle their invoice first,
     then a customer's unallocated payments settle their oldest unpaid invoices (FIFO) */
  const salePaidMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sales) map[s.id] = 0;
    // group customer payments per customer, oldest first
    const custPmts: Record<string, Payment[]> = {};
    for (const p of payments) {
      if (p.type !== "customer") continue;
      if (p.saleId) map[p.saleId] = (map[p.saleId] ?? 0) + p.amount;
      else (custPmts[p.partyId] ??= []).push(p);
    }
    const byCust: Record<string, Sale[]> = {};
    for (const s of sales) (byCust[s.customerId] ??= []).push(s);
    for (const [custId, ss] of Object.entries(byCust)) {
      const queue = (custPmts[custId] ?? []).map((p) => p.amount); // local remaining amounts
      const oldest = [...ss].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
      let qi = 0;
      for (const s of oldest) {
        let paid = map[s.id] ?? 0;
        const due = Math.max(0, saleGrandTotal(s) - paid);
        while (qi < queue.length && due - paid > 0.001) {
          const take = Math.min(queue[qi], due - paid);
          paid += take;
          queue[qi] -= take;
          if (queue[qi] <= 0.001) qi++;
        }
        map[s.id] = paid;
      }
    }
    return map;
  }, [sales, payments]);

  const customerBalance = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sales)
      map[s.customerId] = (map[s.customerId] ?? 0) + saleGrandTotal(s);
    for (const p of payments)
      if (p.type === "customer")
        map[p.partyId] = (map[p.partyId] ?? 0) - p.amount;
    return (id: string) => map[id] ?? 0;
  }, [sales, payments]);


  const supplierBalance = useMemo(() => {
    const map: Record<string, number> = {};
    // Canonical rule: mill dues come ONLY from each purchase's paid amount
    // (steel amount only — transport & other costs are ours, never owed).
    // `payments[]` rows of type "supplier" are the readable journal copy of
    // those same payments (recorded by the Pay-Supplier flow & seed) and must
    // NOT be subtracted again, or dues would be double-counted.
    for (const p of purchases)
      map[p.supplierId] =
        (map[p.supplierId] ?? 0) + Math.max(0, steelAmount(p) - (p.paid ?? 0));
    return (id: string) => map[id] ?? 0;
  }, [purchases]);

  const stats = useMemo<DashboardStats>(() => {
    let revenue = 0;
    let cogs = 0;
    for (const s of sales) {
      revenue += saleGrandTotal(s);
      for (const [i, l] of s.lines.entries())
        cogs += l.qty * (lineUnitCost(s.id, i) || byItem[l.item] || 0);
    }
    const totalExpenses = expenses.reduce((a, e) => a + e.amount, 0);
    const customerDues = customers.reduce(
      (a, c) => a + Math.max(0, customerBalance(c.id)),
      0
    );
    const supplierDues = suppliers.reduce(
      (a, s) => a + Math.max(0, supplierBalance(s.id)),
      0
    );
    const stockValue = inventory.reduce((a, r) => a + r.stockValue, 0);
    const stockQty = inventory.reduce((a, r) => a + r.stockQty, 0);
    const grossProfit = revenue - cogs;
    return {
      stockQty,
      stockValue,
      revenue,
      cogs,
      grossProfit,
      expenses: totalExpenses,
      netProfit: grossProfit - totalExpenses,
      customerDues,
      supplierDues,
    };
  }, [sales, lineUnitCost, byItem, expenses, customers, customerBalance, suppliers, supplierBalance, inventory]);

  const store: Store = {
    suppliers,
    customers,
    purchases,
    sales,
    payments,
    expenses,
    products,
    productItems,
    qualities,
    categories,
    attributeDefs,
    attributeOptions,
    variants,
    warehouses,
    locations,
    inventory,
    inventoryByVariant,
    stockMovements,
    byItem,
    byItemSource,
    inventoryBySource,
    stockLots,
    lineUnitCost,
    salePaid: (saleId: string) => salePaidMap[saleId] ?? 0,
    customerBalance,
    supplierBalance,
    stats,
    addPurchase: (p) => setPurchases((prev) => [{ ...p, id: nextId() }, ...prev]),
    updatePurchase: (id, patch) =>
      setPurchases((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
      ),
    deletePurchase: (id) =>
      setPurchases((prev) => prev.filter((p) => p.id !== id)),
    addSale: (s) => {
      const id = nextId();
      // invoice numbers must never repeat — pick one past the largest so far,
      // even if earlier invoices were deleted
      let max = 0;
      for (const x of sales) {
        const m = /^INV-(\d+)$/.exec(x.invoiceNo);
        if (m) max = Math.max(max, Number(m[1]));
      }
      const invoiceNo = `INV-${String(max + 1).padStart(3, "0")}`;
      // record the exact time the sale was made — shown on lists and the printed bill
      setSales((prev) => [{ ...s, id, invoiceNo, createdAt: new Date().toISOString() }, ...prev]);
      return id;
    },
    addPayment: (p) => setPayments((prev) => [{ ...p, id: nextId() }, ...prev]),
    addCustomer: (c) => {
      const id = nextId();
      setCustomers((prev) => [...prev, { ...c, id }]);
      return id;
    },
    addSupplier: (s) => setSuppliers((prev) => [...prev, { ...s, id: nextId() }]),
    addExpense: (e) => setExpenses((prev) => [{ ...e, id: nextId() }, ...prev]),
    addProduct: (name, unit) => {
      const clean = name.trim();
      if (!clean) return "";
      const existing = products.find((p) => p.name.toLowerCase() === clean.toLowerCase());
      if (existing) return existing.id;
      const id = nextId();
      setProducts((prev) => [...prev, { id, businessId: BUSINESS_ID, name: clean, unit, active: true }]);
      return id;
    },
    updateProduct: (id, patch) =>
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    addProductItem: (productId, name) =>
      setProductItems((prev) =>
        prev.some((i) => i.productId === productId && i.name.toLowerCase() === name.toLowerCase())
          ? prev
          : [...prev, { id: nextId(), productId, name }]
      ),
    addQuality: (productId, name, specOnly) =>
      setQualities((prev) =>
        prev.some((q) => q.productId === productId && q.name.toLowerCase() === name.toLowerCase())
          ? prev
          : [
              ...prev,
              specOnly
                ? { id: nextId(), productId, specOnly: true, name }
                : { id: nextId(), productId, name },
            ]
      ),
    // deleting a product also removes all of its categories, attributes,
    // options, variants and (legacy) items/qualities — callers guard history
    deleteProduct: (id) => {
      const catIds = categories.filter((c) => c.productId === id).map((c) => c.id);
      setCategories((prev) => prev.filter((c) => c.productId !== id));
      setAttributeDefs((prev) => prev.filter((d) => !catIds.includes(d.categoryId)));
      const defIds = attributeDefs.filter((d) => catIds.includes(d.categoryId)).map((d) => d.id);
      setAttributeOptions((prev) => prev.filter((o) => !defIds.includes(o.attributeDefId)));
      setVariants((prev) => prev.filter((v) => !catIds.includes(v.categoryId)));
      setProductItems((prev) => prev.filter((i) => i.productId !== id));
      setQualities((prev) => prev.filter((q) => q.productId !== id));
      setProducts((prev) => prev.filter((p) => p.id !== id));
    },
    deleteProductItem: (id) =>
      setProductItems((prev) => prev.filter((i) => i.id !== id)),
    deleteQuality: (id) =>
      setQualities((prev) => prev.filter((q) => q.id !== id)),

    // --- dynamic catalogue configuration ---
    addCategory: (productId, name) => {
      const clean = name.trim();
      if (!clean) return "";
      const existing = categories.find(
        (c) => c.productId === productId && c.name.toLowerCase() === clean.toLowerCase()
      );
      if (existing) return existing.id;
      const id = nextId();
      setCategories((prev) => [...prev, { id, businessId: BUSINESS_ID, productId, name: clean, active: true }]);
      return id;
    },
    renameCategory: (id, name) =>
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name: name.trim() || c.name } : c))),
    setCategoryActive: (id, active) =>
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, active } : c))),
    addAttribute: (categoryId, def) => {
      const name = def.name.trim();
      if (!name) return "";
      if (attributeDefs.some((d) => d.categoryId === categoryId && d.name.toLowerCase() === name.toLowerCase()))
        return "";
      const id = nextId();
      let key = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      if (!key) key = `attr-${id}`;
      const taken = new Set(attributeDefs.filter((d) => d.categoryId === categoryId).map((d) => d.key));
      let k = key;
      let n = 2;
      while (taken.has(k)) k = `${key}_${n++}`;
      const sortOrder =
        attributeDefs.filter((d) => d.categoryId === categoryId).reduce((mx, d) => Math.max(mx, d.sortOrder), 0) + 1;
      setAttributeDefs((prev) => [
        ...prev,
        {
          id,
          businessId: BUSINESS_ID,
          categoryId,
          name,
          key: k,
          type: def.type,
          required: def.required,
          unit: def.unit?.trim() || undefined,
          sortOrder,
          active: true,
        },
      ]);
      if (def.type === "select" && def.options?.length) {
        const options = def.options
          .map((label) => label.trim())
          .filter(Boolean)
          .map((label, i) => ({
            id: `${id}-o${i}`,
            attributeDefId: id,
            label,
            sortOrder: i,
            active: true,
          }));
        setAttributeOptions((prev) => [...prev, ...options]);
      }
      return id;
    },
    patchAttribute: (id, patch) =>
      setAttributeDefs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d))),
    addOption: (attributeDefId, label) => {
      const clean = label.trim();
      if (!clean) return;
      setAttributeOptions((prev) =>
        prev.some((o) => o.attributeDefId === attributeDefId && o.label.toLowerCase() === clean.toLowerCase())
          ? prev
          : [
              ...prev,
              {
                id: nextId(),
                attributeDefId,
                label: clean,
                sortOrder:
                  prev.filter((o) => o.attributeDefId === attributeDefId).reduce((mx, o) => Math.max(mx, o.sortOrder), -1) + 1,
                active: true,
              },
            ]
      );
    },
    patchOption: (id, patch) =>
      setAttributeOptions((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o))),
    addWarehouse: (name) => {
      const clean = name.trim();
      if (!clean) return;
      setWarehouses((prev) =>
        prev.some((w) => w.name.toLowerCase() === clean.toLowerCase())
          ? prev
          : [...prev, { id: nextId(), businessId: BUSINESS_ID, name: clean, active: true }]
      );
    },
    renameWarehouse: (id, name) =>
      setWarehouses((prev) => prev.map((w) => (w.id === id ? { ...w, name: name.trim() || w.name } : w))),
    setWarehouseActive: (id, active) =>
      setWarehouses((prev) => prev.map((w) => (w.id === id ? { ...w, active } : w))),
    addLocation: (warehouseId, name) => {
      const clean = name.trim();
      if (!clean) return;
      setLocations((prev) =>
        prev.some((l) => l.warehouseId === warehouseId && l.name.toLowerCase() === clean.toLowerCase())
          ? prev
          : [...prev, { id: nextId(), warehouseId, name: clean, active: true }]
      );
    },
    renameLocation: (id, name) =>
      setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, name: name.trim() || l.name } : l))),
    setLocationActive: (id, active) =>
      setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, active } : l))),
    ensureVariant: (categoryId, attributes, shortName) => {
      const clean: Record<string, string> = {};
      for (const [key, val] of Object.entries(attributes))
        if (val !== undefined && val.trim() !== "") clean[key] = val.trim();
      const key = variantKey(categoryId, clean);
      const existing = variants.find((v) => v.key === key);
      if (existing) {
        if (!existing.active)
          setVariants((prev) => prev.map((v) => (v.id === existing.id ? { ...v, active: true } : v)));
        return existing;
      }
      const cat = categories.find((c) => c.id === categoryId);
      const defs = attributeDefs.filter((d) => d.categoryId === categoryId);
      const variant: Variant = {
        id: nextId(),
        businessId: BUSINESS_ID,
        categoryId,
        key,
        attributes: clean,
        shortName: shortName?.trim() || defaultShortName(cat?.name ?? "Item", clean, defs),
        active: true,
        createdAt: new Date().toISOString(),
      };
      setVariants((prev) => [...prev, variant]);
      return variant;
    },
    setVariantShortName: (id, shortName) =>
      setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, shortName: shortName.trim() || v.shortName } : v))),
    setVariantActive: (id, active) =>
      setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, active } : v))),
    deleteVariant: (id) => setVariants((prev) => prev.filter((v) => v.id !== id)),
    // removing a customer also removes their sales and the payments made by them
    deleteCustomer: (id) => {
      const saleIds = new Set(
        sales.filter((s) => s.customerId === id).map((s) => s.id)
      );
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      setSales((prev) => prev.filter((s) => s.customerId !== id));
      setPayments((prev) =>
        prev.filter(
          (p) =>
            !(
              p.type === "customer" &&
              (p.partyId === id || (p.saleId && saleIds.has(p.saleId)))
            )
        )
      );
    },
    // removing a supplier also removes their purchases, the sales that drew
    // on that mill's stock, and the payments made to / for those records
    deleteSupplier: (id) => {
      const pIds = new Set(
        purchases.filter((p) => p.supplierId === id).map((p) => p.id)
      );
      const saleIds = new Set(
        sales
          .filter((s) =>
            s.lines.some(
              (l) => l.supplierId === id || (l.purchaseId && pIds.has(l.purchaseId))
            )
          )
          .map((s) => s.id)
      );
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      setPurchases((prev) => prev.filter((p) => p.supplierId !== id));
      setSales((prev) => prev.filter((s) => !saleIds.has(s.id)));
      setPayments((prev) =>
        prev.filter(
          (p) =>
            !(
              (p.saleId && saleIds.has(p.saleId)) ||
              (p.type === "supplier" && p.partyId === id)
            )
        )
      );
    },
    // wiping an inventory item removes every purchase and sale of it, so the
    // row disappears from inventory, purchases and sales together
    deleteInventoryItem: (item) => {
      const saleIds = new Set(
        sales.filter((s) => s.lines.some((l) => l.item === item)).map((s) => s.id)
      );
      setPurchases((prev) => prev.filter((p) => p.item !== item));
      setSales((prev) => prev.filter((s) => !saleIds.has(s.id)));
      setPayments((prev) => prev.filter((p) => !(p.saleId && saleIds.has(p.saleId))));
    },
    // cosmetic cleanup for fully-sold rows: the item leaves the inventory
    // list but its purchases, sales, dues and profit records are untouched
    hideInventoryItem: (item) =>
      setHiddenItems((prev) => (prev.includes(item) ? prev : [...prev, item])),
    // variant-level cascade: removing a variant wipes its purchases, its
    // sales and the payments against those sales (mirrors deleteInventoryItem)
    deleteInventoryVariant: (variantId) => {
      const saleIds = new Set(
        sales.filter((s) => s.lines.some((l) => l.variantId === variantId)).map((s) => s.id)
      );
      setPurchases((prev) => prev.filter((p) => p.variantId !== variantId));
      setSales((prev) => prev.filter((s) => !saleIds.has(s.id)));
      setPayments((prev) => prev.filter((p) => !(p.saleId && saleIds.has(p.saleId))));
    },
    hideInventoryVariant: (variantId) =>
      setHiddenVariants((prev) => (prev.includes(variantId) ? prev : [...prev, variantId])),
  };

  return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
