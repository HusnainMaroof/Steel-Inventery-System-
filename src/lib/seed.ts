import type {
  Customer,
  Product,
  ProductItem,
  Purchase,
  Quality,
  Sale,
  Supplier,
} from "./types";

/*
 * Demo data loaded on first run so every screen has something to show.
 * Products, items and qualities are keyed to the ids below so purchases
 * and sales can reference them consistently.
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
  // Single supplier — the mill we buy everything from
  { id: "sup-amreli", name: "Amreli Steels", mill: "Amreli Steels Ltd", phone: "0300-1112233" },
];

export const seedCustomers: Customer[] = [
  { id: "cust-rahim", name: "Rahim Builders", shop: "Gulberg, Lahore", phone: "0321-9988776" },
];

const iso = (d: string) => `${d}T00:00:00`;

/* realistic transactions so inventory, invoices & balances have data */
export const seedPurchases: Purchase[] = [
  {
    id: "p1",
    date: "2026-08-10",
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
    paid: 400000,
    lastPaidAt: "2026-08-10",
    lastPaidAmount: 400000,
    paymentHistory: [
      { date: iso("2026-08-10"), amount: 400000 },
    ],
  },
  {
    id: "p2",
    date: "2026-08-18",
    supplierId: "sup-amreli",
    product: "Steel",
    item: "4 Sutar",
    quality: "60 Grade",
    qty: 1500, // kg
    unit: "kg",
    rate: 235,
    transport: 1800,
    otherCost: 0,
    sellRate: 275,
    paid: 352500,
    lastPaidAt: "2026-08-18",
    lastPaidAmount: 352500,
    paymentHistory: [
      { date: iso("2026-08-18"), amount: 352500 },
    ],
  },
  {
    id: "p3",
    date: "2026-08-22",
    supplierId: "sup-amreli",
    product: "Cement",
    item: "Grey Cement",
    quality: "53 OPC",
    qty: 500, // bags
    unit: "bag",
    rate: 1250,
    transport: 12000,
    otherCost: 0,
    sellRate: 1400,
    paid: 625000,
    lastPaidAt: "2026-08-22",
    lastPaidAmount: 625000,
    paymentHistory: [
      { date: iso("2026-08-22"), amount: 625000 },
    ],
  },
  {
    id: "p4",
    date: "2026-09-01",
    supplierId: "sup-amreli",
    product: "Cement",
    item: "White Cement",
    quality: "43 OPC",
    qty: 100, // bags
    unit: "bag",
    rate: 2100,
    transport: 4000,
    otherCost: 0,
    sellRate: 2400,
    paid: 210000,
    lastPaidAt: "2026-09-01",
    lastPaidAmount: 210000,
    paymentHistory: [
      { date: iso("2026-09-01"), amount: 210000 },
    ],
  },
  {
    id: "p5",
    date: "2026-09-03",
    supplierId: "sup-amreli",
    product: "Wire",
    item: "Black Annealed Binding Wire",
    quality: "18 Gauge",
    qty: 800, // kg
    unit: "kg",
    rate: 190,
    transport: 1000,
    otherCost: 0,
    sellRate: 225,
    paid: 152000,
    lastPaidAt: "2026-09-03",
    lastPaidAmount: 152000,
    paymentHistory: [
      { date: iso("2026-09-03"), amount: 152000 },
    ],
  },
];

export const seedSales: Sale[] = [
  {
    id: "s1",
    invoiceNo: "INV-001",
    date: "2026-08-25",
    customerId: "cust-rahim",
    discountPct: 0,
    taxPct: 0,
    lines: [
      { item: "3 Sutar", qty: 500, rate: 280, unit: "kg", supplierId: "sup-amreli", purchaseId: "p1" },
      { item: "Grey Cement", qty: 100, rate: 1400, unit: "bag", supplierId: "sup-amreli", purchaseId: "p3" },
    ],
  },
  {
    id: "s2",
    invoiceNo: "INV-002",
    date: "2026-09-04",
    customerId: "cust-rahim",
    discountPct: 2,
    taxPct: 0,
    lines: [
      { item: "4 Sutar", qty: 300, rate: 275, unit: "kg", supplierId: "sup-amreli", purchaseId: "p2" },
    ],
  },
  {
    id: "s3",
    invoiceNo: "INV-003",
    date: "2026-09-05",
    customerId: "cust-rahim",
    discountPct: 0,
    taxPct: 0,
    lines: [
      { item: "Black Annealed Binding Wire", qty: 200, rate: 225, unit: "kg", supplierId: "sup-amreli", purchaseId: "p5" },
    ],
  },
];

export const seedInitialState = {
  suppliers: seedSuppliers,
  customers: seedCustomers,
  purchases: seedPurchases,
  sales: seedSales,
  products: seedProducts,
  productItems: seedProductItems,
  qualities: seedQualities,
};
