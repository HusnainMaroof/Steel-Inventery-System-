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
 * Kept small and easy to follow:
 *   • 1 supplier — Amreli Steels (both purchases are bought from them)
 *   • 1 customer — Rahim Builders (both sales are sold to them)
 *   • 2 purchases — 3 Sutar (unpaid, so mill dues exist) and 4 Sutar
 *     (fully paid)
 *   • 2 sales — one paid off fully, one still owed, so customer dues exist
 *   • matching payments recorded through the normal flows
 *
 * Products, items and qualities stay as the full catalogue (Steel/Wire/
 * Cement) so the entry forms have everything to pick from.
 */

export const seedProducts: Product[] = [
  { id: "prod-steel", name: "Steel", unit: "kg" },
  { id: "prod-wire", name: "Wire", unit: "kg" },
  { id: "prod-cement", name: "Cement", unit: "bag", specLabel: "Factory / Mill" },
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

/* Qualities belong to a product so the right options show per product:
   Steel uses Grades, Wire uses Gauges, Cement carries a Factory / Mill (spec)
   plus OPC grades as its qualities */
export const seedQualities: Quality[] = [
  // Steel — grades
  { id: "qual-40", productId: "prod-steel", name: "40 Grade" },
  { id: "qual-60", productId: "prod-steel", name: "60 Grade" },
  { id: "qual-75", productId: "prod-steel", name: "75 Grade" },
  // Wire — gauges
  { id: "qual-16g", productId: "prod-wire", name: "16 Gauge" },
  { id: "qual-18g", productId: "prod-wire", name: "18 Gauge" },
  { id: "qual-20g", productId: "prod-wire", name: "20 Gauge" },
  // Cement — factory / mill names (the product's spec list)
  { id: "qual-lucky", productId: "prod-cement", specOnly: true, name: "Lucky Cement" },
  { id: "qual-fauji", productId: "prod-cement", specOnly: true, name: "Fauji Cement" },
  { id: "qual-dgkhan", productId: "prod-cement", specOnly: true, name: "DG Khan Cement" },
  { id: "qual-maple", productId: "prod-cement", specOnly: true, name: "Maple Leaf Cement" },
  // Cement — OPC grades (the product's qualities)
  { id: "qual-33", productId: "prod-cement", name: "33 OPC" },
  { id: "qual-43", productId: "prod-cement", name: "43 OPC" },
  { id: "qual-53", productId: "prod-cement", name: "53 OPC" },
];

export const seedSuppliers: Supplier[] = [
  { id: "sup-amreli", name: "Amreli Steels", mill: "Amreli Steels Ltd, Lahore", phone: "0300-1112233" },
];

export const seedCustomers: Customer[] = [
  { id: "cust-rahim", name: "Rahim Builders", shop: "Gulberg, Lahore", phone: "0321-9988776" },
];

/* Purchases — mostly unpaid, so mill dues show on the dashboard */
export const seedPurchases: Purchase[] = [
  {
    id: "p1",
    date: "2026-09-01",
    supplierId: "sup-amreli",
    product: "Steel",
    item: "3 Sutar",
    quality: "60 Grade",
    qty: 1000, // kg
    unit: "kg",
    rate: 240, // per kg
    transport: 2500,
    otherCost: 0,
    sellRate: 280,
    paid: 0,
  },
  {
    id: "p2",
    date: "2026-09-02",
    supplierId: "sup-amreli",
    product: "Steel",
    item: "4 Sutar",
    quality: "60 Grade",
    qty: 600, // kg
    unit: "kg",
    rate: 250, // per kg
    transport: 1800,
    otherCost: 0,
    sellRate: 290,
    paid: 150000,
    lastPaidAt: "2026-09-03",
    lastPaidAmount: 150000,
    paymentHistory: [{ date: "2026-09-03T10:00:00", amount: 150000 }],
  },
];

/* Sales — one paid off fully, the second still owed, so customer dues show */
export const seedSales: Sale[] = [
  {
    id: "s1",
    invoiceNo: "INV-001",
    date: "2026-09-04",
    createdAt: "2026-09-04T11:20:00",
    customerId: "cust-rahim",
    discountPct: 0,
    taxPct: 0,
    lines: [
      { item: "3 Sutar", qty: 300, rate: 280, unit: "kg", quality: "60 Grade", supplierId: "sup-amreli", purchaseId: "p1" },
    ],
  },
  {
    id: "s2",
    invoiceNo: "INV-002",
    date: "2026-09-07",
    createdAt: "2026-09-07T15:40:00",
    customerId: "cust-rahim",
    discountPct: 0,
    taxPct: 0,
    lines: [
      { item: "3 Sutar", qty: 400, rate: 280, unit: "kg", quality: "60 Grade", supplierId: "sup-amreli", purchaseId: "p1" },
      { item: "4 Sutar", qty: 200, rate: 290, unit: "kg", quality: "60 Grade", supplierId: "sup-amreli", purchaseId: "p2" },
    ],
  },
];

/* Journal copy of what has been paid — matches the paid fields above */
export const seedPayments: Payment[] = [
  { id: "pmt1", date: "2026-09-03", type: "supplier", partyId: "sup-amreli", amount: 150000, method: "Bank", note: "Payment on 4 Sutar purchase" },
  { id: "pmt2", date: "2026-09-05", type: "customer", partyId: "cust-rahim", amount: 84000, method: "Bank", saleId: "s1", note: "Payment on INV-001" },
];

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
