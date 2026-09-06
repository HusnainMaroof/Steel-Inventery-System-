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

export const STEEL_ITEMS = [
  "Rebar 10mm",
  "Rebar 12mm",
  "Rebar 16mm",
  "Rebar 20mm",
  "TMT Grade 60",
  "Angle Iron 40mm",
  "Channel 4in",
  "MS Sheet 3mm",
  "GI Sheet 26g",
];

/* ————— Products (main categories you trade in) ————— */
export const products: Product[] = [
  { id: "pr1", name: "Rebar" },
  { id: "pr2", name: "Structural" },
  { id: "pr3", name: "Sheets" },
  { id: "pr4", name: "Cement" },
];

export const productItems: ProductItem[] = [
  { id: "it1", productId: "pr1", name: "Rebar 10mm" },
  { id: "it2", productId: "pr1", name: "Rebar 12mm" },
  { id: "it3", productId: "pr1", name: "Rebar 16mm" },
  { id: "it4", productId: "pr1", name: "Rebar 20mm" },
  { id: "it5", productId: "pr1", name: "TMT Grade 60" },
  { id: "it6", productId: "pr2", name: "Angle Iron 40mm" },
  { id: "it7", productId: "pr2", name: "Channel 4in" },
  { id: "it8", productId: "pr3", name: "MS Sheet 3mm" },
  { id: "it9", productId: "pr3", name: "GI Sheet 26g" },
  { id: "it10", productId: "pr4", name: "Bestway Cement" },
];

export const qualities: Quality[] = [
  { id: "q1", name: "Grade A (Mill Certified)" },
  { id: "q2", name: "Grade B (Local)" },
  { id: "q3", name: "Mill Second" },
];

/* ————— Mills / Suppliers (you owe them for steel) ————— */
export const suppliers: Supplier[] = [
  { id: "s1", name: "Ittefaq Steel Mills", mill: "Lahore", phone: "0300-111-2233" },
  { id: "s2", name: "Mughal Iron & Steel", mill: "Lahore", phone: "0300-222-3344" },
  { id: "s3", name: "Amreli Steels", mill: "Karachi", phone: "0300-333-4455" },
  { id: "s4", name: "Frontier Works Steel", mill: "Islamabad", phone: "0300-444-5566" },
  { id: "s5", name: "Attock Cement Depot", mill: "Wah Cantt", phone: "0300-555-6677" },
  { id: "s6", name: "Lucky Cement Works", mill: "Karachi", phone: "0300-666-7788" },
];

export const customers: Customer[] = [
  { id: "c1", name: "Ahmed Builders", shop: "Gulberg, Lahore", phone: "0321-100-1001" },
  { id: "c2", name: "Malik Construction", shop: "DHA Phase 5, Lahore", phone: "0321-200-1002" },
  { id: "c3", name: "Rehman Hardware", shop: "Township, Lahore", phone: "0321-300-1003" },
  { id: "c4", name: "Bismillah Traders", shop: "Shahdara, Lahore", phone: "0321-400-1004" },
  { id: "c5", name: "Khan & Sons", shop: "Johar Town, Lahore", phone: "0321-500-1005" },
  { id: "c6", name: "Naveen Developers", shop: "Model Town, Lahore", phone: "0321-600-1006" },
  { id: "c7", name: "Al-Raheem Contractors", shop: "Iqbal Town, Lahore", phone: "0321-700-1007" },
  { id: "c8", name: "Sadiq Builders", shop: "Wapda Town, Lahore", phone: "0321-800-1008" },
];

/* ————— Purchases —————
   Steel quantities are stored in TONS internally (a kg entry is divided by 1000).
   Rate is per ton internally (kg entries are multiplied by 1000).
   "paid" is what you've paid the mill so far — used to show outstanding dues. */
export const purchases: Purchase[] = [
  // July — Ittefaq & Mughal rebar, fully paid
  { id: "p1", date: "2026-07-03", supplierId: "s1", product: "Rebar", item: "Rebar 10mm", quality: "Grade A (Mill Certified)", qty: 40, unit: "ton", rate: 268000, transport: 42000, otherCost: 15000, sellRate: 289000, paid: 11050000, lastPaidAt: "2026-07-10", lastPaidAmount: 2000000, paymentHistory: [{ date: "2026-07-10T00:00:00", amount: 2000000 }, { date: "2026-07-25T00:00:00", amount: 9050000 }] },
  { id: "p2", date: "2026-07-05", supplierId: "s2", product: "Rebar", item: "Rebar 12mm", quality: "Grade A (Mill Certified)", qty: 35, unit: "ton", rate: 265000, transport: 38000, otherCost: 12000, sellRate: 292000, paid: 9275000, lastPaidAt: "2026-07-05", lastPaidAmount: 9275000, paymentHistory: [{ date: "2026-07-05T00:00:00", amount: 9275000 }] },
  // July — Amreli TMT, still partially owed
  { id: "p3", date: "2026-07-08", supplierId: "s3", product: "Rebar", item: "TMT Grade 60", quality: "Grade A (Mill Certified)", qty: 25, unit: "ton", rate: 292000, transport: 51000, otherCost: 18000, sellRate: 315000, paid: 6000000, lastPaidAt: "2026-07-08", lastPaidAmount: 6000000, paymentHistory: [{ date: "2026-07-08T00:00:00", amount: 6000000 }] },
  { id: "p4", date: "2026-07-12", supplierId: "s1", product: "Structural", item: "Angle Iron 40mm", quality: "Grade B (Local)", qty: 15, unit: "ton", rate: 248000, transport: 22000, otherCost: 8000, sellRate: 269000, paid: 3720000, lastPaidAt: "2026-07-12", lastPaidAmount: 3720000, paymentHistory: [{ date: "2026-07-12T00:00:00", amount: 3720000 }] },
  { id: "p5", date: "2026-07-18", supplierId: "s4", product: "Rebar", item: "Rebar 16mm", quality: "Grade B (Local)", qty: 45, unit: "ton", rate: 271000, transport: 44000, otherCost: 16000, sellRate: 295000, paid: 12195000, lastPaidAt: "2026-07-18", lastPaidAmount: 12195000, paymentHistory: [{ date: "2026-07-18T00:00:00", amount: 12195000 }] },
  { id: "p6", date: "2026-07-22", supplierId: "s2", product: "Sheets", item: "MS Sheet 3mm", quality: "Grade A (Mill Certified)", qty: 12, unit: "ton", rate: 232000, transport: 19000, otherCost: 7000, sellRate: 254000, paid: 2784000, lastPaidAt: "2026-07-22", lastPaidAmount: 2784000, paymentHistory: [{ date: "2026-07-22T00:00:00", amount: 2784000 }] },
  // August — smaller mixed order incl. a kg-entry rebar; some still owed
  { id: "p7", date: "2026-08-02", supplierId: "s3", product: "Rebar", item: "Rebar 10mm", quality: "Grade A (Mill Certified)", qty: 30, unit: "ton", rate: 273000, transport: 39000, otherCost: 14000, sellRate: 296000, paid: 8190000, lastPaidAt: "2026-08-02", lastPaidAmount: 8190000, paymentHistory: [{ date: "2026-08-02T00:00:00", amount: 8190000 }] },
  { id: "p8", date: "2026-08-06", supplierId: "s1", product: "Structural", item: "Channel 4in", quality: "Grade B (Local)", qty: 18, unit: "ton", rate: 256000, transport: 26000, otherCost: 9000, sellRate: 278000, paid: 4608000, lastPaidAt: "2026-08-06", lastPaidAmount: 4608000, paymentHistory: [{ date: "2026-08-06T00:00:00", amount: 4608000 }] },
  { id: "p9", date: "2026-08-10", supplierId: "s4", product: "Sheets", item: "GI Sheet 26g", quality: "Grade A (Mill Certified)", qty: 10, unit: "ton", rate: 226000, transport: 17000, otherCost: 6000, sellRate: 248000, paid: 2260000, lastPaidAt: "2026-08-10", lastPaidAmount: 2260000, paymentHistory: [{ date: "2026-08-10T00:00:00", amount: 2260000 }] },
  { id: "p10", date: "2026-08-14", supplierId: "s2", product: "Rebar", item: "Rebar 12mm", quality: "Grade A (Mill Certified)", qty: 28, unit: "ton", rate: 270000, transport: 36000, otherCost: 13000, sellRate: 297000, paid: 7560000, lastPaidAt: "2026-08-14", lastPaidAmount: 7560000, paymentHistory: [{ date: "2026-08-14T00:00:00", amount: 7560000 }] },
  // kg entry — sells are in tons; this simulates buying small lots priced per kg
  { id: "p11", date: "2026-08-21", supplierId: "s1", product: "Structural", item: "Angle Iron 40mm", quality: "Mill Second", qty: 2.4, unit: "kg", rate: 248000, transport: 0, otherCost: 0, sellRate: 269000, paid: 595200, lastPaidAt: "2026-08-21", lastPaidAmount: 595200, paymentHistory: [{ date: "2026-08-21T00:00:00", amount: 595200 }] },
  // Sept — two open mill dues (one Amreli TMT, one Attock cement)
  { id: "p12", date: "2026-09-01", supplierId: "s3", product: "Rebar", item: "TMT Grade 60", quality: "Grade A (Mill Certified)", qty: 40, unit: "ton", rate: 295000, transport: 62000, otherCost: 20000, sellRate: 318000, paid: 6000000, lastPaidAt: "2026-09-01", lastPaidAmount: 6000000, paymentHistory: [{ date: "2026-09-01T00:00:00", amount: 6000000 }] },
  { id: "p13", date: "2026-09-05", supplierId: "s1", product: "Rebar", item: "Rebar 20mm", quality: "Grade A (Mill Certified)", qty: 22, unit: "ton", rate: 277000, transport: 30000, otherCost: 11000, sellRate: 299000, paid: 6094000, lastPaidAt: "2026-09-05", lastPaidAmount: 6094000, paymentHistory: [{ date: "2026-09-05T00:00:00", amount: 6094000 }] },
  // cement arrives only through the cement supplier (separate agency trade)
  { id: "p14", date: "2026-09-09", supplierId: "s5", product: "Cement", item: "Bestway Cement", qty: 100, unit: "ton", rate: 32000, transport: 25000, otherCost: 10000, sellRate: 36000, paid: 0, lastPaidAt: undefined, lastPaidAmount: 0, paymentHistory: [] },
  { id: "p15", date: "2026-09-12", supplierId: "s6", product: "Cement", item: "Bestway Cement", qty: 80, unit: "ton", rate: 32500, transport: 18000, otherCost: 8000, sellRate: 36500, paid: 1300000, lastPaidAt: "2026-09-12", lastPaidAmount: 1300000, paymentHistory: [{ date: "2026-09-12T00:00:00", amount: 1300000 }] },
];

/* ————— Sales —————
   Invoice numbers auto-increment from the count of seed sales, so keep these
   contiguous starting at INV-001. Quantities in tons. */
export const sales: Sale[] = [
  { id: "v1", invoiceNo: "INV-001", date: "2026-07-09", customerId: "c1", lines: [{ item: "Rebar 10mm", qty: 12, rate: 289000 }, { item: "Rebar 12mm", qty: 8, rate: 292000 }] },
  { id: "v2", invoiceNo: "INV-002", date: "2026-07-14", customerId: "c2", lines: [{ item: "TMT Grade 60", qty: 10, rate: 315000 }] },
  { id: "v3", invoiceNo: "INV-003", date: "2026-07-19", customerId: "c3", lines: [{ item: "Angle Iron 40mm", qty: 6, rate: 269000 }, { item: "Rebar 10mm", qty: 9, rate: 290000 }] },
  { id: "v4", invoiceNo: "INV-004", date: "2026-07-26", customerId: "c4", lines: [{ item: "Rebar 16mm", qty: 14, rate: 295000 }] },
  { id: "v5", invoiceNo: "INV-005", date: "2026-07-30", customerId: "c5", lines: [{ item: "MS Sheet 3mm", qty: 5, rate: 254000 }] },
  { id: "v6", invoiceNo: "INV-006", date: "2026-08-04", customerId: "c6", lines: [{ item: "Rebar 10mm", qty: 15, rate: 296000 }] },
  { id: "v7", invoiceNo: "INV-007", date: "2026-08-08", customerId: "c1", lines: [{ item: "Channel 4in", qty: 7, rate: 278000 }, { item: "Angle Iron 40mm", qty: 4, rate: 271000 }] },
  { id: "v8", invoiceNo: "INV-008", date: "2026-08-12", customerId: "c2", lines: [{ item: "GI Sheet 26g", qty: 6, rate: 248000 }, { item: "Rebar 12mm", qty: 10, rate: 297000 }] },
  { id: "v9", invoiceNo: "INV-009", date: "2026-08-16", customerId: "c5", lines: [{ item: "Rebar 16mm", qty: 9, rate: 299000 }] },
  { id: "v10", invoiceNo: "INV-010", date: "2026-08-18", customerId: "c4", lines: [{ item: "TMT Grade 60", qty: 8, rate: 318000 }] },
  { id: "v11", invoiceNo: "INV-011", date: "2026-08-24", customerId: "c7", lines: [{ item: "Rebar 12mm", qty: 16, rate: 298000 }, { item: "Rebar 16mm", qty: 8, rate: 300000 }] },
  { id: "v12", invoiceNo: "INV-012", date: "2026-08-29", customerId: "c3", lines: [{ item: "Rebar 10mm", qty: 10, rate: 297000 }, { item: "MS Sheet 3mm", qty: 3, rate: 255000 }] },
  { id: "v13", invoiceNo: "INV-013", date: "2026-09-03", customerId: "c8", lines: [{ item: "TMT Grade 60", qty: 20, rate: 320000 }] },
  { id: "v14", invoiceNo: "INV-014", date: "2026-09-10", customerId: "c2", lines: [{ item: "Rebar 20mm", qty: 12, rate: 302000 }, { item: "Rebar 16mm", qty: 10, rate: 301000 }] },
  { id: "v15", invoiceNo: "INV-015", date: "2026-09-12", customerId: "c5", lines: [{ item: "Bestway Cement", qty: 40, rate: 36000 }, { item: "GI Sheet 26g", qty: 2, rate: 250000 }] },
  { id: "v16", invoiceNo: "INV-016", date: "2026-09-16", customerId: "c6", lines: [{ item: "Rebar 12mm", qty: 14, rate: 300000 }, { item: "Rebar 10mm", qty: 18, rate: 298000 }] },
];

/* ————— Payments —————
   Customer payments (money IN, reduces their balance). Supplier payments are
   recorded in paymentHistory on the purchase itself, so no duplicate here. */
export const payments: Payment[] = [
  { id: "pm1", date: "2026-07-11", type: "customer", partyId: "c1", amount: 5000000, method: "Bank" },
  { id: "pm2", date: "2026-07-16", type: "customer", partyId: "c2", amount: 3150000, method: "Cash" },
  { id: "pm3", date: "2026-07-20", type: "customer", partyId: "c3", amount: 4000000, method: "Cash" },
  { id: "pm4", date: "2026-07-25", type: "customer", partyId: "c4", amount: 3000000, method: "Bank" },
  { id: "pm5", date: "2026-07-28", type: "customer", partyId: "c5", amount: 1270000, method: "Cash" },
  { id: "pm6", date: "2026-08-05", type: "customer", partyId: "c6", amount: 4440000, method: "Bank" },
  { id: "pm7", date: "2026-08-10", type: "customer", partyId: "c1", amount: 2500000, method: "Cash" },
  { id: "pm8", date: "2026-08-15", type: "customer", partyId: "c5", amount: 1270000, method: "Cash" },
  { id: "pm9", date: "2026-08-18", type: "customer", partyId: "c2", amount: 2000000, method: "Bank" },
  { id: "pm10", date: "2026-08-22", type: "customer", partyId: "c3", amount: 4000000, method: "Cheque" },
  { id: "pm11", date: "2026-08-27", type: "customer", partyId: "c4", amount: 5000000, method: "Bank" },
  { id: "pm12", date: "2026-08-30", type: "customer", partyId: "c7", amount: 1500000, method: "Cash" },
  { id: "pm13", date: "2026-09-05", type: "customer", partyId: "c8", amount: 2500000, method: "Bank" },
  { id: "pm14", date: "2026-09-10", type: "customer", partyId: "c2", amount: 1000000, method: "Cash" },
  { id: "pm15", date: "2026-09-12", type: "customer", partyId: "c5", amount: 800000, method: "Cash" },
];

export const expenses: Expense[] = [
  { id: "e1", date: "2026-07-01", label: "Shop rent — July", category: "Rent", amount: 85000 },
  { id: "e2", date: "2026-07-15", label: "Loader & unloading labor", category: "Labor", amount: 32000 },
  { id: "e3", date: "2026-08-01", label: "Shop rent — August", category: "Rent", amount: 85000 },
  { id: "e4", date: "2026-08-08", label: "Electricity bill", category: "Utilities", amount: 24500 },
  { id: "e5", date: "2026-08-14", label: "Delivery van fuel", category: "Transport", amount: 18700 },
  { id: "e6", date: "2026-09-01", label: "Shop rent — September", category: "Rent", amount: 85000 },
  { id: "e7", date: "2026-09-07", label: "Loader & unloading labor", category: "Labor", amount: 41000 },
  { id: "e8", date: "2026-09-11", label: "Crane hire for unloading", category: "Other", amount: 35000 },
];
