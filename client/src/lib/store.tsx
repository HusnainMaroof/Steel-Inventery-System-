"use client";

import React, {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  StockCheck,
  StockLot,
  StockMovementView,
  Supplier,
  Variant,
  StaffMember,
  Warehouse,
  WarehouseLocation,
} from "./types";
import type { StaffPage } from "./staff-access";
import { createCoalescedRefresh } from "./refresh-coalesce";
import { purchaseParentId, steelAmount as purchaseSteelAmount } from "./purchase-utils";
import {
  round2,
  saleChargesTotal,
  saleDiscountAmount,
  saleGrandTotalAmount,
  saleTaxAmount,
  saleTaxableAmount,
} from "./money";
import {
  mergeUiPreferences,
  UI_PREFERENCES_DEFAULTS,
  type UiPreferences,
} from "./ui-preferences";
import { attrsEqual, defaultShortName, identityKey, optionAppearsIn, scopedDefs, variantKey } from "./catalogue";
import type { ProductTemplate } from "./templates";
import { useAuth } from "./auth";
import { apiFetch, jsonBody } from "./api";
import { normalizeBootstrap, type ApiBootstrap } from "./backend-adapters";

export const purchaseTotal = (p: Purchase) =>
  p.qty * p.rate +
  p.transport +
  (p.loadingCharges ?? 0) +
  (p.labourCharges ?? 0) +
  p.otherCost;

// what we owe the MILL: steel amount only — transport & other costs are on us
export const steelAmount = purchaseSteelAmount;

/* subtotal = goods total before discount & tax */
export const saleTotal = (s: Sale) =>
  s.lines.reduce((sum, l) => sum + l.qty * l.rate, 0);

/* invoice-wide money helpers — round at same boundaries as the server */
export const saleDiscount = (s: Sale) =>
  saleDiscountAmount(s.lines, s.discountPct ?? 0);
export const saleTaxable = (s: Sale) =>
  saleTaxableAmount(s.lines, s.discountPct ?? 0);
export const saleTax = (s: Sale) =>
  saleTaxAmount(s.lines, s.discountPct ?? 0, s.taxPct ?? 0);
export const saleCharges = (s: Sale) =>
  saleChargesTotal({
    loading: s.loadingCharges,
    transport: s.transportCharges,
    labour: s.labourCharges,
  });
export const saleGrandTotal = (s: Sale) =>
  s.invoiceTotal ?? saleGrandTotalAmount(s);
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
  ready: boolean;
  /** True once transaction collections have been loaded (may lag behind ready). */
  transactionsReady: boolean;
  /** Bumps after each successful bootstrap — use to invalidate derived caches */
  dataVersion: number;
  error: string | null;
  pending: string | null;
  isPending: (key?: string) => boolean;
  retry: () => void;
  refresh: () => Promise<void>;
  suppliers: Supplier[];
  customers: Customer[];
  purchases: Purchase[];
  sales: Sale[];
  payments: Payment[];
  expenses: Expense[];
  stockChecks: StockCheck[];
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
  uiPrefs: UiPreferences;
  updateUiPrefs: (patch: Partial<UiPreferences>) => Promise<void>;
  staff: StaffMember[];
  addStaff: (input: {
    name: string;
    email: string;
    password: string;
    title: string;
    access: StaffPage[];
  }) => Promise<void>;
  updateStaff: (
    id: string,
    input: { name?: string; title?: string; access?: StaffPage[]; password?: string },
  ) => Promise<void>;
  removeStaff: (id: string) => Promise<void>;
  addPurchase: (p: Omit<Purchase, "id">) => Promise<void>;
  updatePurchase: (id: string, patch: Partial<Purchase>) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;
  addSale: (s: Omit<Sale, "id" | "invoiceNo" | "createdAt"> & { paidNow?: number }) => Promise<string>;
  deleteSale: (id: string) => Promise<void>;
  addPayment: (p: Omit<Payment, "id">) => Promise<void>;
  addCustomer: (c: Omit<Customer, "id">) => Promise<string>;
  addSupplier: (s: Omit<Supplier, "id">) => Promise<void>;
  addExpense: (e: Omit<Expense, "id">) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  recordStockCheck: (c: Omit<StockCheck, "id" | "systemQty">) => Promise<void>;
  addProduct: (name: string, unit: string, description?: string, usesCategories?: boolean) => Promise<string>;
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>;
  addProductItem: (productId: string, name: string) => Promise<void>;
  addQuality: (productId: string, name: string, specOnly?: boolean) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  deleteProductItem: (id: string) => Promise<void>;
  deleteQuality: (id: string) => Promise<void>;
  // --- dynamic catalogue configuration ---
  addCategory: (productId: string, name: string, description?: string) => Promise<string>;
  updateCategory: (id: string, patch: Partial<ProductCategory>) => Promise<void>;
  renameCategory: (id: string, name: string) => Promise<void>;
  /** delete a Category — refused (no-op) while any transaction references its variants */
  deleteCategory: (id: string) => Promise<void>;
  setCategoryActive: (id: string, active: boolean) => Promise<void>;
  /** aliases kept so older call sites compile; owner-facing name is Category */
  addItem: (productId: string, name: string, description?: string) => Promise<string>;
  updateItem: (id: string, patch: Partial<ProductCategory>) => Promise<void>;
  renameItem: (id: string, name: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  setItemActive: (id: string, active: boolean) => Promise<void>;
  /** create a product, its items, attributes and options from a template in one shot */
  addProductFromTemplate: (t: ProductTemplate) => Promise<string>;
  addAttribute: (
    productId: string,
    categoryId: string | undefined,
    def: { name: string; type: AttributeDef["type"]; required: boolean; unit?: string; options?: string[] }
  ) => Promise<string>;
  patchAttribute: (id: string, patch: Partial<AttributeDef>) => Promise<void>;
  deleteAttribute: (id: string) => Promise<void>;
  reorderAttributes: (productId: string, categoryId: string | undefined, orderedIds: string[]) => Promise<void>;
  addOption: (attributeDefId: string, label: string) => Promise<string>;
  patchOption: (id: string, patch: Partial<AttributeOption>) => Promise<void>;
  deleteOption: (id: string) => Promise<boolean>;
  reorderOptions: (attributeDefId: string, orderedIds: string[]) => Promise<void>;
  isOptionUsed: (id: string) => boolean;
  isAttributeUsed: (id: string) => boolean;
  addWarehouse: (name: string) => Promise<void>;
  renameWarehouse: (id: string, name: string) => Promise<void>;
  setWarehouseActive: (id: string, active: boolean) => Promise<void>;
  addLocation: (warehouseId: string, name: string) => Promise<void>;
  renameLocation: (id: string, name: string) => Promise<void>;
  setLocationActive: (id: string, active: boolean) => Promise<void>;
  /** find-or-create the variant for an attribute combination (deduped by key) */
  ensureVariant: (productId: string, categoryId: string | undefined, attributes: Record<string, string>, shortName?: string) => Promise<Variant>;
  setVariantShortName: (id: string, shortName: string) => Promise<void>;
  setVariantActive: (id: string, active: boolean) => Promise<void>;
  deleteVariant: (id: string) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  deleteInventoryItem: (item: string) => void;
  hideInventoryItem: (item: string) => void; // removes a sold-out row from the inventory list only — records & numbers stay
  deleteInventoryVariant: (variantId: string) => void; // cascade: that variant's purchases + sales + their payments
  hideInventoryVariant: (variantId: string) => void; // cosmetic removal of a sold-out variant row
}

const StoreCtx = createContext<Store | null>(null);

interface LedgerState {
  version: number;
  suppliers: Supplier[];
  customers: Customer[];
  purchases: Purchase[];
  sales: Sale[];
  payments: Payment[];
  expenses: Expense[];
  stockChecks: StockCheck[];
  products: Product[];
  productItems: ProductItem[];
  qualities: Quality[];
  categories: ProductCategory[];
  attributeDefs: AttributeDef[];
  attributeOptions: AttributeOption[];
  variants: Variant[];
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  staff: StaffMember[];
  settings: UiPreferences;
  hiddenItems: string[];
  hiddenVariants: string[];
}

const emptyLedger = (): LedgerState => ({
  version: 1,
  suppliers: [],
  customers: [],
  purchases: [],
  sales: [],
  payments: [],
  expenses: [],
  stockChecks: [],
  products: [],
  productItems: [],
  qualities: [],
  categories: [],
  attributeDefs: [],
  attributeOptions: [],
  variants: [],
  warehouses: [],
  locations: [],
  staff: [],
  settings: UI_PREFERENCES_DEFAULTS,
  hiddenItems: [],
  hiddenVariants: [],
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const initial = emptyLedger();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initial.suppliers);
  const [customers, setCustomers] = useState<Customer[]>(initial.customers);
  const [purchases, setPurchases] = useState<Purchase[]>(initial.purchases);
  const [sales, setSales] = useState<Sale[]>(initial.sales);
  const [payments, setPayments] = useState<Payment[]>(initial.payments);
  const [expenses, setExpenses] = useState<Expense[]>(initial.expenses);
  const [stockChecks, setStockChecks] = useState<StockCheck[]>(initial.stockChecks);
  const [products, setProducts] = useState<Product[]>(initial.products);
  const [productItems, setProductItems] = useState<ProductItem[]>(initial.productItems);
  const [qualities, setQualities] = useState<Quality[]>(initial.qualities);
  const [categories, setCategories] = useState<ProductCategory[]>(initial.categories);
  const [attributeDefs, setAttributeDefs] = useState<AttributeDef[]>(initial.attributeDefs);
  const [attributeOptions, setAttributeOptions] = useState<AttributeOption[]>(initial.attributeOptions);
  const [variants, setVariants] = useState<Variant[]>(initial.variants);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initial.warehouses);
  const [locations, setLocations] = useState<WarehouseLocation[]>(initial.locations);
  const [staff, setStaff] = useState<StaffMember[]>(initial.staff);
  const [uiPrefs, setUiPrefs] = useState<UiPreferences>(initial.settings);
  const [hiddenItems, setHiddenItems] = useState<string[]>([]);
  const [hiddenVariants, setHiddenVariants] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [transactionsReady, setTransactionsReady] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const hasBootstrappedRef = useRef(false);
  const lastTenantRef = useRef<string | null>(null);
  const lastReloadKeyRef = useRef(0);

  const applyBootstrap = useCallback((raw: ApiBootstrap) => {
    const data = normalizeBootstrap(raw);
    setSuppliers(data.suppliers);
    setCustomers(data.customers);
    setPurchases(data.purchases);
    setSales(data.sales);
    setPayments(data.payments);
    setExpenses(data.expenses);
    setStockChecks(data.stockChecks);
    setProducts(data.products);
    setProductItems(data.productItems);
    setQualities(data.qualities);
    setCategories(data.categories);
    setAttributeDefs(data.attributeDefs);
    setAttributeOptions(data.attributeOptions);
    setVariants(data.variants);
    setWarehouses(data.warehouses);
    setLocations(data.locations);
    setStaff(data.staff);
    setUiPrefs(data.settings);
  }, []);

  const applyTransactions = useCallback(
    (raw: Pick<
      ApiBootstrap,
      | "customers"
      | "suppliers"
      | "purchases"
      | "sales"
      | "payments"
      | "expenses"
      | "stockChecks"
    >) => {
      const data = normalizeBootstrap({
        version: 3,
        customers: raw.customers,
        suppliers: raw.suppliers,
        purchases: raw.purchases,
        sales: raw.sales,
        payments: raw.payments,
        expenses: raw.expenses,
        stockChecks: raw.stockChecks,
        products,
        productItems,
        categories,
        attributeDefs,
        attributeOptions,
        variants,
        warehouses,
        locations,
      });
      setCustomers(data.customers);
      setSuppliers(data.suppliers);
      setPurchases(data.purchases);
      setSales(data.sales);
      setPayments(data.payments);
      setExpenses(data.expenses);
      setStockChecks(data.stockChecks);
      setTransactionsReady(true);
      setDataVersion((v) => v + 1);
    },
    [
      products,
      productItems,
      categories,
      attributeDefs,
      attributeOptions,
      variants,
      warehouses,
      locations,
    ],
  );

  const loadTransactions = useCallback(async () => {
    const payload = await apiFetch<{
      data: Pick<
        ApiBootstrap,
        | "customers"
        | "suppliers"
        | "purchases"
        | "sales"
        | "payments"
        | "expenses"
        | "stockChecks"
      >;
    }>("/ledger/transactions");
    applyTransactions(payload.data);
  }, [applyTransactions]);

  const refreshCore = useCallback(async () => {
    setTransactionsReady(false);
    const response = await apiFetch<{ data: ApiBootstrap }>("/ledger/bootstrap");
    applyBootstrap(response.data);
    setDataVersion((v) => v + 1);
    void loadTransactions().catch(() => {
      setTransactionsReady(false);
    });
  }, [applyBootstrap, loadTransactions]);

  const refreshFull = useCallback(async () => {
    setTransactionsReady(false);
    const response = await apiFetch<{ data: ApiBootstrap }>("/ledger/bootstrap");
    applyBootstrap(response.data);
    await loadTransactions();
  }, [applyBootstrap, loadTransactions]);

  const refresh = useMemo(
    () => createCoalescedRefresh(refreshFull),
    [refreshFull],
  );

  useEffect(() => {
    if (!authReady) return;
    if (!user || user.role === "SUPERADMIN") {
      if (!user) {
        hasBootstrappedRef.current = false;
        lastTenantRef.current = null;
        lastReloadKeyRef.current = 0;
        setReady(false);
        setTransactionsReady(false);
        setDataVersion(0);
      }
      return;
    }

    const tenantKey = `${user.id}:${user.businessId}`;
    const tenantChanged = lastTenantRef.current !== tenantKey;
    const retryRequested = lastReloadKeyRef.current !== reloadKey;

    if (tenantChanged) {
      lastTenantRef.current = tenantKey;
      hasBootstrappedRef.current = false;
    }

    if (hasBootstrappedRef.current && !retryRequested) return;

    lastReloadKeyRef.current = reloadKey;
    const task = window.setTimeout(() => {
      if (!hasBootstrappedRef.current) setReady(false);
      setError(null);
      void refreshCore()
        .then(() => {
          hasBootstrappedRef.current = true;
          setReady(true);
        })
        .catch((reason: unknown) => {
          const message =
            reason instanceof Error ? reason.message : "Could not load the ledger";
          setError(message);
          setReady(false);
        });
    }, 0);
    return () => window.clearTimeout(task);
  }, [authReady, user?.id, user?.businessId, user?.role, reloadKey, refreshCore]);

  const updateUiPrefs = useCallback(
    async (patch: Partial<UiPreferences>) => {
      if (!user || user.role === "SUPERADMIN") return;
      const prev = uiPrefs;
      const next = mergeUiPreferences({ ...prev, ...patch });
      setUiPrefs(next);
      try {
        await apiFetch("/settings", {
          method: "PUT",
          ...jsonBody({ data: next }),
        });
      } catch (reason) {
        setUiPrefs(prev);
        throw reason;
      }
    },
    [uiPrefs, user],
  );

  const mutate = async <T,>(key: string, operation: () => Promise<T>): Promise<T> => {
    setPending(key);
    setError(null);
    try {
      const result = await operation();
      await refresh();
      return result;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Request failed";
      setError(message);
      throw reason;
    } finally {
      setPending(null);
    }
  };

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
          const elig = lots.filter((x) => purchaseParentId(x.p) === l.purchaseId);
          const c = consume(elig, l.qty);
          unit = c >= 0 ? c : fallback(l.item);
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
        purchaseId: purchaseParentId(l.p),
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
      const cat = v?.categoryId ? catById.get(v.categoryId) : a.categoryId ? catById.get(a.categoryId) : undefined;
      const prod =
        (v?.productId ? productById.get(v.productId) : undefined) ??
        (cat ? productById.get(cat.productId) : undefined);
      const landedAvg = a.pq > 0 ? a.cost / a.pq : 0;
      const stockQty = a.pq - a.sq;
      const showCat = prod?.usesCategories === true;
      return {
        variantId: a.variantId,
        legacyItem: a.legacyItem,
        productId: prod?.id,
        product: prod?.name ?? (a.legacyItem ? productNameOfItem[a.legacyItem] : undefined),
        categoryId: showCat ? cat?.id : undefined,
        category: showCat ? cat?.name : undefined,
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
      const cat =
        (v?.categoryId ? catById.get(v.categoryId) : undefined) ??
        (l.categoryId ? catById.get(l.categoryId) : undefined);
      const prod =
        (v?.productId ? productById.get(v.productId) : undefined) ??
        (cat ? productById.get(cat.productId) : undefined);
      const showCat = prod?.usesCategories === true;
      return {
        productId: prod?.id,
        categoryId: showCat ? (cat?.id ?? l.categoryId) : undefined,
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
        purchaseId: purchaseParentId(p),
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
        let need = Math.max(0, saleGrandTotal(s) - paid);
        while (qi < queue.length && need > 0.001) {
          const take = Math.min(queue[qi], need);
          paid = round2(paid + take);
          need = round2(need - take);
          queue[qi] = round2(queue[qi] - take);
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
    const byPurchase = new Map<string, { supplierId: string; goods: number; paid: number }>();
    for (const p of purchases) {
      const pid = purchaseParentId(p);
      const row = byPurchase.get(pid) ?? {
        supplierId: p.supplierId,
        goods: 0,
        paid: p.paid ?? 0,
      };
      row.goods += steelAmount(p);
      byPurchase.set(pid, row);
    }
    for (const row of byPurchase.values()) {
      map[row.supplierId] =
        (map[row.supplierId] ?? 0) + Math.max(0, row.goods - row.paid);
    }
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
    ready,
    transactionsReady,
    dataVersion,
    error,
    pending,
    retry: () => setReloadKey((value) => value + 1),
    refresh,
    isPending: (key?: string) => (key ? pending === key : pending != null),
    suppliers,
    customers,
    purchases,
    sales,
    payments,
    expenses,
    stockChecks,
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
    salePaid: (saleId: string) => {
      const sale = sales.find((s) => s.id === saleId);
      if (sale?.invoicePaid != null) return sale.invoicePaid;
      return salePaidMap[saleId] ?? 0;
    },
    customerBalance,
    supplierBalance,
    stats,
    uiPrefs,
    updateUiPrefs,
    staff,
    addStaff: async (input) => {
      await mutate("staff:create", () =>
        apiFetch("/users", {
          method: "POST",
          ...jsonBody({
            name: input.name.trim(),
            email: input.email.trim().toLowerCase(),
            password: input.password,
            title: input.title.trim(),
            access: input.access,
            role: "SUBADMIN",
          }),
        }),
      );
    },
    updateStaff: async (id, input) => {
      const body: Record<string, unknown> = {};
      if (input.name !== undefined) body.name = input.name.trim();
      if (input.title !== undefined) body.title = input.title.trim();
      if (input.access !== undefined) body.access = input.access;
      if (input.password) body.password = input.password;
      await mutate(`staff:update:${id}`, () =>
        apiFetch(`/users/${id}`, { method: "PATCH", ...jsonBody(body) }),
      );
    },
    removeStaff: async (id) => {
      await mutate(`staff:delete:${id}`, () =>
        apiFetch(`/users/${id}`, { method: "DELETE" }),
      );
    },
    addPurchase: async (p) => {
      const variant = p.variantId ? variants.find((item) => item.id === p.variantId) : undefined;
      const product = products.find((item) => item.id === variant?.productId || item.name === p.product);
      if (!product) throw new Error("Choose a valid product");
      await mutate("purchase:create", () => apiFetch("/purchases", {
        method: "POST",
        ...jsonBody({
          date: p.date,
          supplierId: p.supplierId,
          transport: p.transport,
          loading: p.loadingCharges ?? 0,
          labour: p.labourCharges ?? 0,
          otherCost: p.otherCost,
          paid: p.paid ?? 0,
          lines: [{
            productId: product.id,
            variantId: p.variantId,
            categoryId: p.categoryId,
            item: p.item,
            attributeSnapshot: p.attributeSnapshot,
            qty: p.qty,
            unit: p.unit,
            rate: p.rate,
            sellRate: p.sellRate,
            productName: p.product,
            spec: p.spec,
            quality: p.quality,
            lotNumber: p.lotNumber,
            heatNumber: p.heatNumber,
            batchNumber: p.batchNumber,
            warehouseId: p.warehouseId,
            locationId: p.locationId,
          }],
        }),
      }));
    },
    updatePurchase: async (id, patch) => {
      const current = purchases.find((purchase) => purchase.id === id);
      if (!current) throw new Error("Purchase not found");
      const next = { ...current, ...patch };
      const parentId = purchaseParentId(current);
      await mutate(`purchase:update:${parentId}`, () => apiFetch(`/purchases/${parentId}`, {
        method: "PATCH",
        ...jsonBody({
          date: next.date,
          supplierId: next.supplierId,
          transport: next.transport,
          loading: next.loadingCharges ?? 0,
          labour: next.labourCharges ?? 0,
          otherCost: next.otherCost,
          paid: next.paid ?? 0,
        }),
      }));
    },
    deletePurchase: async (id) => {
      const current = purchases.find((purchase) => purchase.id === id);
      const parentId = current ? purchaseParentId(current) : id;
      await mutate(`purchase:delete:${parentId}`, () =>
        apiFetch(`/purchases/${parentId}`, { method: "DELETE" }),
      );
    },
    addSale: async (s) => {
      const result = await mutate<{ sale: { id: string } }>("sale:create", () =>
        apiFetch("/sales", {
          method: "POST",
          ...jsonBody({
            date: s.date,
            customerId: s.customerId,
            discountPct: s.discountPct ?? 0,
            taxPct: s.taxPct ?? 0,
            loadingCharges: s.loadingCharges ?? 0,
            transportCharges: s.transportCharges ?? 0,
            labourCharges: s.labourCharges ?? 0,
            paidNow: s.paidNow ?? 0,
            lines: s.lines.map((line) => {
              const variant = line.variantId ? variants.find((item) => item.id === line.variantId) : undefined;
              const product = products.find((item) => item.id === variant?.productId);
              if (!product) throw new Error(`Product not found for ${line.item}`);
              return {
                productId: product.id,
                variantId: line.variantId,
                categoryId: line.categoryId,
                purchaseId: line.purchaseId,
                item: line.item,
                attributeSnapshot: line.attributeSnapshot,
                qualityName: line.qualityName,
                qty: line.qty,
                unit: line.unit,
                rate: line.rate,
              };
            }),
          }),
        }),
      );
      return result.sale.id;
    },
    addPayment: async (p) => {
      await mutate("payment:create", () => apiFetch("/payments", {
        method: "POST",
        ...jsonBody({
          date: p.date,
          type: p.type.toUpperCase(),
          customerId: p.type === "customer" ? p.partyId : undefined,
          supplierId: p.type === "supplier" ? p.partyId : undefined,
          amount: p.amount,
          method: p.method.toUpperCase(),
          saleId: p.saleId,
          note: p.note,
        }),
      }));
    },
    deleteSale: async (id) => {
      await mutate(`sale:delete:${id}`, () => apiFetch(`/sales/${id}`, { method: "DELETE" }));
    },
    addCustomer: async (c) => {
      const created = await mutate<{ id: string }>("customer:create", () =>
        apiFetch("/customers", { method: "POST", ...jsonBody(c) }),
      );
      return created.id;
    },
    addSupplier: async (s) => {
      await mutate("supplier:create", () => apiFetch("/suppliers", { method: "POST", ...jsonBody(s) }));
    },
    addExpense: async (e) => {
      await mutate("expense:create", () => apiFetch("/expenses", {
        method: "POST",
        ...jsonBody({ ...e, category: e.category.toUpperCase() }),
      }));
    },
    deleteExpense: async (id) => {
      await mutate(`expense:delete:${id}`, () => apiFetch(`/expenses/${id}`, { method: "DELETE" }));
    },
    recordStockCheck: async (c) => {
      await mutate("stock-check:create", () =>
        apiFetch("/stock-checks", { method: "POST", ...jsonBody(c) }),
      );
    },
    addProduct: async (name, unit, description, usesCategories) => {
      const clean = name.trim();
      if (!clean) return "";
      const existing = products.find((p) => p.name.toLowerCase() === clean.toLowerCase());
      if (existing) return existing.id;
      const created = await mutate<{ id: string }>("product:create", () =>
        apiFetch("/products", {
          method: "POST",
          ...jsonBody({ name: clean, unit, description: description?.trim() || undefined, usesCategories: !!usesCategories }),
        }),
      );
      return created.id;
    },
    updateProduct: async (id, patch) => {
      await mutate(`product:update:${id}`, () => apiFetch(`/products/${id}`, { method: "PATCH", ...jsonBody(patch) }));
    },
    addProductItem: async () => undefined,
    addQuality: async () => undefined,
    deleteProduct: async (id) => {
      await mutate(`product:delete:${id}`, () => apiFetch(`/products/${id}`, { method: "DELETE" }));
    },
    deleteProductItem: async () => undefined,
    deleteQuality: async () => undefined,

    // --- dynamic catalogue configuration ---
    addCategory: async (productId, name, description) => {
      const clean = name.trim();
      if (!clean) return "";
      const existing = categories.find(
        (c) => c.productId === productId && c.name.toLowerCase() === clean.toLowerCase()
      );
      if (existing) return existing.id;
      const created = await mutate<{ id: string }>("category:create", () =>
        apiFetch(`/products/${productId}/categories`, {
          method: "POST",
          ...jsonBody({ name: clean, description: description?.trim() || undefined }),
        }),
      );
      return created.id;
    },
    updateCategory: async (id, patch) => {
      await mutate(`category:update:${id}`, () =>
        apiFetch(`/products/categories/${id}`, { method: "PATCH", ...jsonBody(patch) }),
      );
    },
    renameCategory: async (id, name) => {
      await mutate(`category:rename:${id}`, () =>
        apiFetch(`/products/categories/${id}`, { method: "PATCH", ...jsonBody({ name }) }),
      );
    },
    deleteCategory: async (id) => {
      await mutate(`category:delete:${id}`, () => apiFetch(`/products/categories/${id}`, { method: "DELETE" }));
    },
    setCategoryActive: async (id, active) => {
      await mutate(`category:active:${id}`, () =>
        apiFetch(`/products/categories/${id}`, { method: "PATCH", ...jsonBody({ active }) }),
      );
    },
    addItem: async (productId, name, description) =>
      store.addCategory(productId, name, description),
    updateItem: async (id, patch) => store.updateCategory(id, patch),
    renameItem: async (id, name) => store.renameCategory(id, name),
    deleteItem: async (id) => store.deleteCategory(id),
    setItemActive: async (id, active) => store.setCategoryActive(id, active),
    /** one-shot: product + items + attributes + options from a template */
    addProductFromTemplate: async (t) => {
      const clean = t.product.name.trim();
      if (!clean) return "";
      const existing = products.find((p) => p.name.toLowerCase() === clean.toLowerCase());
      if (existing) return existing.id;
      return mutate("product:template", async () => {
        const product = await apiFetch<{ id: string }>("/products", {
          method: "POST",
          ...jsonBody({
            name: clean,
            unit: t.product.unit,
            description: t.product.description?.trim() || undefined,
            usesCategories: t.usesCategories,
          }),
        });
        const addDefs = async (
          attrs: { name: string; type: AttributeDef["type"]; required: boolean; unit?: string; options?: string[] }[],
          categoryId?: string,
        ) => {
          for (const [index, attribute] of attrs.entries()) {
            const name = attribute.name.trim();
            if (!name) continue;
            const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `attribute_${index}`;
            const created = await apiFetch<{ id: string }>(`/products/${product.id}/attributes`, {
              method: "POST",
              ...jsonBody({
                name,
                key,
                type: attribute.type,
                required: attribute.required,
                unit: attribute.unit,
                categoryId,
                sortOrder: index + 1,
              }),
            });
            for (const [optionIndex, label] of (attribute.options ?? []).entries()) {
              if (!label.trim()) continue;
              await apiFetch(`/products/attributes/${created.id}/options`, {
                method: "POST",
                ...jsonBody({ label: label.trim(), sortOrder: optionIndex }),
              });
            }
          }
        };
        if (t.usesCategories) {
          for (const category of t.categories ?? []) {
            if (!category.name.trim()) continue;
            const created = await apiFetch<{ id: string }>(`/products/${product.id}/categories`, {
              method: "POST",
              ...jsonBody({ name: category.name.trim(), description: category.description }),
            });
            await addDefs(category.attributes, created.id);
          }
        } else {
          await addDefs(t.attributes ?? []);
        }
        return product.id;
      });
    },
    addAttribute: async (productId, categoryId, def) => {
      const name = def.name.trim();
      if (!name) return "";
      const siblings = scopedDefs(attributeDefs, productId, categoryId);
      if (siblings.some((d) => d.name.toLowerCase() === name.toLowerCase())) return "";
      let key = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      if (!key) key = "attribute";
      const taken = new Set(siblings.map((d) => d.key));
      let k = key;
      let n = 2;
      while (taken.has(k)) k = `${key}_${n++}`;
      const sortOrder = siblings.reduce((mx, d) => Math.max(mx, d.sortOrder), 0) + 1;
      return mutate("attribute:create", async () => {
        const created = await apiFetch<{ id: string }>(`/products/${productId}/attributes`, {
          method: "POST",
          ...jsonBody({
            name,
            key: k,
            type: def.type,
            required: def.required,
            unit: def.unit?.trim() || undefined,
            sortOrder,
            active: true,
            categoryId,
          }),
        });
        for (const [index, label] of (def.options ?? []).entries()) {
          if (!label.trim()) continue;
          await apiFetch(`/products/attributes/${created.id}/options`, {
            method: "POST",
            ...jsonBody({ label: label.trim(), sortOrder: index }),
          });
        }
        return created.id;
      });
    },
    patchAttribute: async (id, patch) => {
      await mutate(`attribute:update:${id}`, () =>
        apiFetch(`/products/attributes/${id}`, { method: "PATCH", ...jsonBody(patch) }),
      );
    },
    addOption: async (attributeDefId, label) => {
      const clean = label.trim();
      if (!clean) return "";
      const existing = attributeOptions.find(
        (o) => o.attributeDefId === attributeDefId && o.label.toLowerCase() === clean.toLowerCase()
      );
      if (existing) return existing.id;
      const created = await mutate<{ id: string }>("option:create", () =>
        apiFetch(`/products/attributes/${attributeDefId}/options`, {
          method: "POST",
          ...jsonBody({
            label: clean,
            sortOrder: attributeOptions
              .filter((option) => option.attributeDefId === attributeDefId)
              .reduce((max, option) => Math.max(max, option.sortOrder), -1) + 1,
          }),
        }),
      );
      return created.id;
    },
    patchOption: async (id, patch) => {
      await mutate(`option:update:${id}`, () =>
        apiFetch(`/products/options/${id}`, { method: "PATCH", ...jsonBody(patch) }),
      );
    },
    isOptionUsed: (id) => {
      const opt = attributeOptions.find((o) => o.id === id);
      if (!opt) return false;
      const def = attributeDefs.find((d) => d.id === opt.attributeDefId);
      const snaps = [
        ...purchases.map((p) => p.attributeSnapshot),
        ...sales.flatMap((s) => s.lines.map((l) => l.attributeSnapshot)),
      ];
      return optionAppearsIn(opt, def, variants, snaps);
    },
    deleteOption: async (id) => {
      const opt = attributeOptions.find((o) => o.id === id);
      if (!opt) return false;
      const def = attributeDefs.find((d) => d.id === opt.attributeDefId);
      const snaps = [
        ...purchases.map((p) => p.attributeSnapshot),
        ...sales.flatMap((s) => s.lines.map((l) => l.attributeSnapshot)),
      ];
      if (optionAppearsIn(opt, def, variants, snaps)) return false;
      await mutate(`option:delete:${id}`, () => apiFetch(`/products/options/${id}`, { method: "DELETE" }));
      return true;
    },
    reorderOptions: async (attributeDefId, orderedIds) => {
      await mutate(`option:order:${attributeDefId}`, () =>
        apiFetch(`/products/attributes/${attributeDefId}/options/order`, {
          method: "PUT",
          ...jsonBody({ ids: orderedIds }),
        }),
      );
    },
    isAttributeUsed: (id) => {
      const def = attributeDefs.find((d) => d.id === id);
      if (!def) return false;
      if (variants.some((v) => v.attributes[def.key])) return true;
      if (purchases.some((p) => p.attributeSnapshot?.[def.key])) return true;
      return sales.some((s) => s.lines.some((l) => l.attributeSnapshot?.[def.key]));
    },
    deleteAttribute: async (id) => {
      await mutate(`attribute:delete:${id}`, () => apiFetch(`/products/attributes/${id}`, { method: "DELETE" }));
    },
    reorderAttributes: async (productId, _categoryId, orderedIds) => {
      await mutate(`attribute:order:${productId}`, () =>
        apiFetch(`/products/${productId}/attributes/order`, {
          method: "PUT",
          ...jsonBody({ ids: orderedIds }),
        }),
      );
    },
    addWarehouse: async (name) => {
      const clean = name.trim();
      if (!clean) return;
      if (warehouses.some((warehouse) => warehouse.name.toLowerCase() === clean.toLowerCase())) return;
      await mutate("warehouse:create", () =>
        apiFetch("/warehouses", { method: "POST", ...jsonBody({ name: clean }) }),
      );
    },
    renameWarehouse: async (id, name) => {
      await mutate(`warehouse:rename:${id}`, () =>
        apiFetch(`/warehouses/${id}`, { method: "PATCH", ...jsonBody({ name }) }),
      );
    },
    setWarehouseActive: async (id, active) => {
      await mutate(`warehouse:active:${id}`, () =>
        apiFetch(`/warehouses/${id}`, { method: "PATCH", ...jsonBody({ active }) }),
      );
    },
    addLocation: async (warehouseId, name) => {
      const clean = name.trim();
      if (!clean) return;
      if (locations.some((location) => location.warehouseId === warehouseId && location.name.toLowerCase() === clean.toLowerCase())) return;
      await mutate("location:create", () =>
        apiFetch(`/warehouses/${warehouseId}/locations`, { method: "POST", ...jsonBody({ name: clean }) }),
      );
    },
    renameLocation: async (id, name) => {
      await mutate(`location:rename:${id}`, () =>
        apiFetch(`/warehouses/locations/${id}`, { method: "PATCH", ...jsonBody({ name }) }),
      );
    },
    setLocationActive: async (id, active) => {
      await mutate(`location:active:${id}`, () =>
        apiFetch(`/warehouses/locations/${id}`, { method: "PATCH", ...jsonBody({ active }) }),
      );
    },
    ensureVariant: async (productId, categoryId, attributes, shortName) => {
      const clean: Record<string, string> = {};
      for (const [key, val] of Object.entries(attributes))
        if (val !== undefined && val.trim() !== "") clean[key] = val.trim();
      const defs = scopedDefs(attributeDefs, productId, categoryId);
      const scopeId = categoryId || productId;
      const ident = identityKey(scopeId, clean, defs, attributeOptions);
      const legacy = variantKey(scopeId, clean);
      const legacyCat = categoryId ? variantKey(categoryId, clean) : undefined;
      const ofProduct = (v: Variant) => {
        if (v.productId === productId) return true;
        const cat = v.categoryId ? categories.find((c) => c.id === v.categoryId) : undefined;
        return cat?.productId === productId;
      };
      const existing =
        variants.find((v) => v.identityKey === ident || v.key === ident || v.key === legacy || (legacyCat && v.key === legacyCat)) ??
        variants.find((v) => ofProduct(v) && (!categoryId || v.categoryId === categoryId) && attrsEqual(v.attributes, clean)) ??
        (!categoryId ? variants.find((v) => ofProduct(v) && attrsEqual(v.attributes, clean)) : undefined);
      if (existing) {
        if (!existing.active) {
          await mutate(`variant:active:${existing.id}`, () =>
            apiFetch(`/products/variants/${existing.id}`, { method: "PATCH", ...jsonBody({ active: true }) }),
          );
        }
        return existing;
      }
      const category = categoryId ? categories.find((item) => item.id === categoryId) : undefined;
      const product = products.find((item) => item.id === productId);
      return mutate<Variant>("variant:create", () =>
        apiFetch(`/products/${productId}/variants`, {
          method: "POST",
          ...jsonBody({
            categoryId,
            attributes: clean,
            shortName: shortName?.trim() || defaultShortName(category?.name ?? product?.name ?? "Item", clean, defs),
          }),
        }),
      );
    },
    setVariantShortName: async (id, shortName) => {
      await mutate(`variant:rename:${id}`, () =>
        apiFetch(`/products/variants/${id}`, { method: "PATCH", ...jsonBody({ shortName }) }),
      );
    },
    setVariantActive: async (id, active) => {
      await mutate(`variant:active:${id}`, () =>
        apiFetch(`/products/variants/${id}`, { method: "PATCH", ...jsonBody({ active }) }),
      );
    },
    deleteVariant: async (id) => {
      await mutate(`variant:delete:${id}`, () => apiFetch(`/products/variants/${id}`, { method: "DELETE" }));
    },
    deleteCustomer: async (id) => {
      await mutate(`customer:delete:${id}`, () => apiFetch(`/customers/${id}`, { method: "DELETE" }));
    },
    deleteSupplier: async (id) => {
      await mutate(`supplier:delete:${id}`, () => apiFetch(`/suppliers/${id}`, { method: "DELETE" }));
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

  return (
    <StoreCtx.Provider value={store}>
      {children}
      {pending && user && user.role !== "SUPERADMIN" && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-0 left-0 right-0 z-[99] h-0.5 overflow-hidden bg-neutral-200"
        >
          <div className="h-full w-1/3 bg-[#171717] animate-[skeleton-shimmer_1s_ease-in-out_infinite]" />
        </div>
      )}
      {error && user && user.role !== "SUPERADMIN" && (
        <div
          role="alert"
          className="fixed right-4 bottom-4 z-[100] max-w-sm rounded-md border border-[#f0e2de] bg-[#faf5f2] px-4 py-3 text-sm text-[#a12b1f] shadow-lg"
        >
          <p>{error}</p>
          <button className="mt-2 underline" onClick={() => setReloadKey((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
