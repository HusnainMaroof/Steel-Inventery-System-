"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as seed from "./mockData";
import type {
  Customer,
  Expense,
  InventoryRow,
  Payment,
  Purchase,
  Sale,
  Supplier,
} from "./types";

export const purchaseTotal = (p: Purchase) =>
  p.qty * p.rate + p.transport + p.otherCost;

export const saleTotal = (s: Sale) =>
  s.lines.reduce((sum, l) => sum + l.qty * l.rate, 0);

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
  inventory: InventoryRow[];
  byItem: Record<string, number>; // item -> weighted avg landed cost
  customerBalance: (id: string) => number; // + = owes us, - = advance
  supplierBalance: (id: string) => number; // + = we owe
  stats: DashboardStats;
  addPurchase: (p: Omit<Purchase, "id">) => void;
  updatePurchase: (id: string, patch: Partial<Purchase>) => void;
  deletePurchase: (id: string) => void;
  addSale: (s: Omit<Sale, "id" | "invoiceNo">) => void;
  addPayment: (p: Omit<Payment, "id">) => void;
  addExpense: (e: Omit<Expense, "id">) => void;
}

const StoreCtx = createContext<Store | null>(null);

let seq = 1000;
const nextId = () => `x${seq++}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [suppliers] = useState<Supplier[]>(seed.suppliers);
  const [customers] = useState<Customer[]>(seed.customers);
  const [purchases, setPurchases] = useState<Purchase[]>(seed.purchases);
  const [sales, setSales] = useState<Sale[]>(seed.sales);
  const [payments, setPayments] = useState<Payment[]>(seed.payments);
  const [expenses, setExpenses] = useState<Expense[]>(seed.expenses);

  const { inventory, byItem } = useMemo(() => {
    const map: Record<
      string,
      { pq: number; cost: number; sq: number; rev: number }
    > = {};
    for (const p of purchases) {
      const m = (map[p.item] ??= { pq: 0, cost: 0, sq: 0, rev: 0 });
      m.pq += p.qty;
      m.cost += purchaseTotal(p);
    }
    for (const s of sales) {
      for (const l of s.lines) {
        const m = (map[l.item] ??= { pq: 0, cost: 0, sq: 0, rev: 0 });
        m.sq += l.qty;
        m.rev += l.qty * l.rate;
      }
    }
    const rows: InventoryRow[] = [];
    const itemMap: Record<string, number> = {};
    for (const [item, m] of Object.entries(map)) {
      const landedAvg = m.pq > 0 ? m.cost / m.pq : 0;
      const stockQty = m.pq - m.sq;
      rows.push({
        item,
        purchasedQty: m.pq,
        soldQty: m.sq,
        stockQty,
        totalCost: m.cost,
        landedAvg,
        stockValue: stockQty * landedAvg,
        avgSellRate: m.sq > 0 ? m.rev / m.sq : 0,
      });
      itemMap[item] = landedAvg;
    }
    rows.sort((a, b) => a.item.localeCompare(b.item));
    return { inventory: rows, byItem: itemMap };
  }, [purchases, sales]);

  const customerBalance = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sales)
      map[s.customerId] = (map[s.customerId] ?? 0) + saleTotal(s);
    for (const p of payments)
      if (p.type === "customer")
        map[p.partyId] = (map[p.partyId] ?? 0) - p.amount;
    return (id: string) => map[id] ?? 0;
  }, [sales, payments]);

  const supplierBalance = useMemo(() => {
    const map: Record<string, number> = {};
    // dues are tracked per purchase: total cost minus what was already paid
    for (const p of purchases)
      map[p.supplierId] =
        (map[p.supplierId] ?? 0) + Math.max(0, purchaseTotal(p) - (p.paid ?? 0));
    for (const p of payments)
      if (p.type === "supplier")
        map[p.partyId] = (map[p.partyId] ?? 0) - p.amount;
    return (id: string) => map[id] ?? 0;
  }, [purchases, payments]);

  const stats = useMemo<DashboardStats>(() => {
    let revenue = 0;
    let cogs = 0;
    for (const s of sales) {
      revenue += saleTotal(s);
      for (const l of s.lines)
        cogs += l.qty * (byItem[l.item] ?? 0);
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
  }, [sales, byItem, expenses, customers, customerBalance, suppliers, supplierBalance, inventory]);

  const store: Store = {
    suppliers,
    customers,
    purchases,
    sales,
    payments,
    expenses,
    inventory,
    byItem,
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
      const invoiceNo = `INV-${String(sales.length + seed.sales.length + 1).padStart(3, "0")}`;
      setSales((prev) => [{ ...s, id: nextId(), invoiceNo }, ...prev]);
    },
    addPayment: (p) => setPayments((prev) => [{ ...p, id: nextId() }, ...prev]),
    addExpense: (e) => setExpenses((prev) => [{ ...e, id: nextId() }, ...prev]),
  };

  return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
