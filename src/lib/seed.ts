import type {
  Customer,
  Expense,
  Payment,
  Product,
  ProductItem,
  Purchase,
  Quality,
  Sale,
  Supplier,
} from "./types";

/*
 * Demo data loaded on first run so every screen has something to show.
 *
 * Kept deliberately minimal so the flow is easy to follow:
 *   • 1 supplier — Amreli Steels (everything is bought from them)
 *   • 1 customer — Rahim Builders (everything is sold to them)
 *   • 1 purchase — a 2,000 kg load of 3 Sutar (unpaid, so mill dues exist)
 *   • 1 sale     — 500 kg of that steel to the customer (unpaid, so customer
 *                  dues exist)
 *   • no payments / expenses yet — record them through the app to watch
 *     inventory, dues and profit move.
 *
 * Products, items and qualities stay as the full catalogue (Steel/Wire/
 * Cement) so the entry forms have everything to pick from.
 */

export const seedProducts: Product[] = [
  { id: "prod-steel", name: "Steel", unit: "kg" },
  { id: "prod-wire", name: "Wire", unit: "kg" },
  { id: "prod-cement", name: "Cement", unit: "bag" },
];

export const seedProductItems: ProductItem[] = [
  // Steel — Sutar sizes
  { id: "item-sutar-2", productId: "prod-steel", name: "2 Sutar" },
  { id: "item-sutar-3", productId: "prod-steel", name: "3 Sutar" },
  { id: "item-sutar-4", productId: "prod-steel", name: "4 Sutar" },
  { id: "item-sutar-5", productId: "prod-steel", name: "5 Sutar" },
  { id: "item-sutar-6", productId: "prod-steel", name: "6 Sutar" },
  { id: "item-sutar-8", productId: "prod-steel", name: "8 Sutar" },
  // Wire
  { id: "item-wire-ba", productId: "prod-wire", name: "Black Annealed Binding Wire" },
  { id: "item-wire-gi", productId: "prod-wire", name: "G.I Wire" },
  // Cement
  { id: "item-cement-grey", productId: "prod-cement", name: "Grey Cement" },
  { id: "item-cement-white", productId: "prod-cement", name: "White Cement" },
];

export const seedQualities: Quality[] = [
  { id: "qual-40", name: "40 Grade" },
  { id: "qual-60", name: "60 Grade" },
  { id: "qual-75", name: "75 Grade" },
  { id: "qual-16g", name: "16 Gauge" },
  { id: "qual-18g", name: "18 Gauge" },
  { id: "qual-20g", name: "20 Gauge" },
  { id: "qual-33", name: "33 OPC" },
  { id: "qual-43", name: "43 OPC" },
  { id: "qual-53", name: "53 OPC" },
];

export const seedSuppliers: Supplier[] = [
  { id: "sup-amreli", name: "Amreli Steels", mill: "Amreli Steels Ltd, Lahore", phone: "0300-1112233" },
];

export const seedCustomers: Customer[] = [
  { id: "cust-rahim", name: "Rahim Builders", shop: "Gulberg, Lahore", phone: "0321-9988776" },
];

/* The single purchase — 3 Sutar, unpaid so the mill has a due */
export const seedPurchases: Purchase[] = [
  {
    id: "p1",
    date: "2026-09-08",
    supplierId: "sup-amreli",
    product: "Steel",
    item: "3 Sutar",
    quality: "60 Grade",
    qty: 2000, // kg
    unit: "kg",
    rate: 240, // per kg
    transport: 2500,
    otherCost: 0,
    sellRate: 280,
    paid: 0,
  },
];

/* The single sale — 500 kg of that load sold to Rahim Builders */
export const seedSales: Sale[] = [
  {
    id: "s1",
    invoiceNo: "INV-001",
    date: "2026-09-08",
    createdAt: "2026-09-08T11:20:00",
    customerId: "cust-rahim",
    discountPct: 0,
    taxPct: 0,
    lines: [
      { item: "3 Sutar", qty: 500, rate: 280, unit: "kg", quality: "60 Grade", supplierId: "sup-amreli", purchaseId: "p1" },
    ],
  },
];

export const seedPayments: Payment[] = [];

export const seedExpenses: Expense[] = [];

export const seedInitialState = {
  suppliers: seedSuppliers,
  customers: seedCustomers,
  purchases: seedPurchases,
  sales: seedSales,
  payments: seedPayments,
  expenses: seedExpenses,
  products: seedProducts,
  productItems: seedProductItems,
  qualities: seedQualities,
};
