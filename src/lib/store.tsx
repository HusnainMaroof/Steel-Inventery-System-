"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Customer,
  Expense,
  InventoryRow,
  Payment,
  Product,
  ProductItem,
  Purchase,
  Quality,
  Sale,
  StockLot,
  Supplier,
} from "./types";
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

export type InvoiceStatus = "paid" | "partial" | "unpaid" | "advance";
export const invoiceStatus = (paid: number, total: number): InvoiceStatus =>
  paid <= 0 ? "unpaid" : paid >= total - 0.001 ? (paid > total + 0.001 ? "advance" : "paid") : "partial";

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
  inventory: InventoryRow[];
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
  addSale: (s: Omit<Sale, "id" | "invoiceNo">) => string;
  addPayment: (p: Omit<Payment, "id">) => void;
  addCustomer: (c: Omit<Customer, "id">) => string;
  addSupplier: (s: Omit<Supplier, "id">) => void;
  addExpense: (e: Omit<Expense, "id">) => void;
  addProduct: (name: string, unit: string) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  addProductItem: (productId: string, name: string) => void;
  addQuality: (name: string) => void;
  deleteProduct: (id: string) => void;
  deleteProductItem: (id: string) => void;
  deleteQuality: (id: string) => void;
}

const StoreCtx = createContext<Store | null>(null);

let seq = 1000;
const nextId = () => `x${seq++}`;

// seed ids are `prod-*`, `item-*`, `qual-*`, `sup-*`, `cust-*`, plus p1..p5 / s1..s3
const INITIAL = seedInitialState;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL.suppliers);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL.customers);
  const [purchases, setPurchases] = useState<Purchase[]>(INITIAL.purchases);
  const [sales, setSales] = useState<Sale[]>(INITIAL.sales);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>(INITIAL.products);
  const [productItems, setProductItems] = useState<ProductItem[]>(INITIAL.productItems);
  const [qualities, setQualities] = useState<Quality[]>(INITIAL.qualities);

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
    // meta per item: product / quality come from purchases; unit comes from the product
    const meta: Record<string, { product?: string; quality?: string; unit?: string }> = {};
    for (const p of purchases) {
      meta[p.item] = {
        product: p.product || meta[p.item]?.product,
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
    const srcKey = (item: string, supplierId: string) => `${item}\u0000${supplierId}`;
    // purchased totals per item+source
    for (const p of purchases) {
      const k = srcKey(p.item, p.supplierId);
      const a = (srcAgg[k] ??= {
        item: p.item,
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
    }
    // remaining stock per item+source (and the selling price of that remaining stock)
    for (const lot of lots) {
      if (lot.remaining <= 0.000001) continue;
      const a = srcAgg[srcKey(lot.p.item, lot.p.supplierId)];
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
        quality: l.p.quality,
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
  }, [purchases, sales, products, suppliers]);

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
    // dues are tracked per purchase: STEEL amount only minus what was already paid
    // (transport & other costs are our own expense, never owed to the mill)
    for (const p of purchases)
      map[p.supplierId] =
        (map[p.supplierId] ?? 0) + Math.max(0, steelAmount(p) - (p.paid ?? 0));
    for (const p of payments)
      if (p.type === "supplier")
        map[p.partyId] = (map[p.partyId] ?? 0) - p.amount;
    return (id: string) => map[id] ?? 0;
  }, [purchases, payments]);

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
    inventory,
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
      const invoiceNo = `INV-${String(sales.length + 1).padStart(3, "0")}`;
      setSales((prev) => [{ ...s, id, invoiceNo }, ...prev]);
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
    addProduct: (name, unit) =>
      setProducts((prev) =>
        prev.some((p) => p.name.toLowerCase() === name.toLowerCase())
          ? prev
          : [...prev, { id: nextId(), name, unit }]
      ),
    updateProduct: (id, patch) =>
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    addProductItem: (productId, name) =>
      setProductItems((prev) =>
        prev.some((i) => i.productId === productId && i.name.toLowerCase() === name.toLowerCase())
          ? prev
          : [...prev, { id: nextId(), productId, name }]
      ),
    addQuality: (name) =>
      setQualities((prev) =>
        prev.some((q) => q.name.toLowerCase() === name.toLowerCase())
          ? prev
          : [...prev, { id: nextId(), name }]
      ),
    // deleting a product also removes all of its items
    deleteProduct: (id) => {
      setProductItems((prev) => prev.filter((i) => i.productId !== id));
      setProducts((prev) => prev.filter((p) => p.id !== id));
    },
    deleteProductItem: (id) =>
      setProductItems((prev) => prev.filter((i) => i.id !== id)),
    deleteQuality: (id) =>
      setQualities((prev) => prev.filter((q) => q.id !== id)),
  };

  return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
