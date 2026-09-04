import type {
  Customer,
  Expense,
  Payment,
  Purchase,
  Sale,
  Supplier,
} from "./types";

export const STEEL_ITEMS = [
  "Rebar 10mm",
  "Rebar 12mm",
  "Rebar 16mm",
  "TMT Grade 60",
  "Angle Iron 40mm",
  "Channel 4in",
  "MS Sheet 3mm",
  "GI Sheet 26g",
];

export const suppliers: Supplier[] = [
  { id: "s1", name: "Ittefaq Steel Mills", mill: "Lahore", phone: "0300-111-2233" },
  { id: "s2", name: "Mughal Iron & Steel", mill: "Lahore", phone: "0300-222-3344" },
  { id: "s3", name: "Amreli Steels", mill: "Karachi", phone: "0300-333-4455" },
  { id: "s4", name: "Frontier Works Steel", mill: "Islamabad", phone: "0300-444-5566" },
];

export const customers: Customer[] = [
  { id: "c1", name: "Ahmed Builders", shop: "Gulberg", phone: "0321-100-1001" },
  { id: "c2", name: "Malik Construction", shop: "DHA Phase 5", phone: "0321-200-1002" },
  { id: "c3", name: "Rehman Hardware", shop: "Township", phone: "0321-300-1003" },
  { id: "c4", name: "Bismillah Traders", shop: "Shahdara", phone: "0321-400-1004" },
  { id: "c5", name: "Khan & Sons", shop: "Johar Town", phone: "0321-500-1005" },
  { id: "c6", name: "Naveen Developers", shop: "Model Town", phone: "0321-600-1006" },
];

export const purchases: Purchase[] = [
  { id: "p1", date: "2026-07-03", supplierId: "s1", item: "Rebar 10mm", qty: 40, rate: 268000, transport: 42000, otherCost: 15000 },
  { id: "p2", date: "2026-07-05", supplierId: "s2", item: "Rebar 12mm", qty: 35, rate: 265000, transport: 38000, otherCost: 12000 },
  { id: "p3", date: "2026-07-08", supplierId: "s3", item: "TMT Grade 60", qty: 25, rate: 292000, transport: 51000, otherCost: 18000 },
  { id: "p4", date: "2026-07-12", supplierId: "s1", item: "Angle Iron 40mm", qty: 15, rate: 248000, transport: 22000, otherCost: 8000 },
  { id: "p5", date: "2026-07-18", supplierId: "s4", item: "Rebar 16mm", qty: 30, rate: 271000, transport: 44000, otherCost: 16000 },
  { id: "p6", date: "2026-07-22", supplierId: "s2", item: "MS Sheet 3mm", qty: 12, rate: 232000, transport: 19000, otherCost: 7000 },
  { id: "p7", date: "2026-08-02", supplierId: "s3", item: "Rebar 10mm", qty: 30, rate: 273000, transport: 39000, otherCost: 14000 },
  { id: "p8", date: "2026-08-06", supplierId: "s1", item: "Channel 4in", qty: 18, rate: 256000, transport: 26000, otherCost: 9000 },
  { id: "p9", date: "2026-08-10", supplierId: "s4", item: "GI Sheet 26g", qty: 10, rate: 226000, transport: 17000, otherCost: 6000 },
  { id: "p10", date: "2026-08-14", supplierId: "s2", item: "Rebar 12mm", qty: 28, rate: 270000, transport: 36000, otherCost: 13000 },
];

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
];

export const payments: Payment[] = [
  { id: "pm1", date: "2026-07-11", type: "customer", partyId: "c1", amount: 5000000, method: "Bank" },
  { id: "pm2", date: "2026-07-16", type: "customer", partyId: "c2", amount: 3150000, method: "Cash" },
  { id: "pm3", date: "2026-07-10", type: "supplier", partyId: "s1", amount: 9000000, method: "Bank", note: "Partial — load p1" },
  { id: "pm4", date: "2026-07-20", type: "customer", partyId: "c3", amount: 4000000, method: "Cash" },
  { id: "pm5", date: "2026-07-25", type: "customer", partyId: "c4", amount: 3000000, method: "Bank" },
  { id: "pm6", date: "2026-07-28", type: "supplier", partyId: "s2", amount: 8000000, method: "Bank" },
  { id: "pm7", date: "2026-08-05", type: "customer", partyId: "c6", amount: 4440000, method: "Bank" },
  { id: "pm8", date: "2026-08-06", type: "supplier", partyId: "s3", amount: 6000000, method: "Cheque" },
  { id: "pm9", date: "2026-08-10", type: "customer", partyId: "c1", amount: 2500000, method: "Cash" },
  { id: "pm10", date: "2026-08-15", type: "customer", partyId: "c5", amount: 1270000, method: "Cash" },
  { id: "pm11", date: "2026-08-16", type: "supplier", partyId: "s4", amount: 5000000, method: "Bank" },
  { id: "pm12", date: "2026-08-18", type: "customer", partyId: "c2", amount: 2000000, method: "Bank" },
];

export const expenses: Expense[] = [
  { id: "e1", date: "2026-07-01", label: "Shop rent — July", category: "Rent", amount: 85000 },
  { id: "e2", date: "2026-07-15", label: "Loader & unloading labor", category: "Labor", amount: 32000 },
  { id: "e3", date: "2026-08-01", label: "Shop rent — August", category: "Rent", amount: 85000 },
  { id: "e4", date: "2026-08-08", label: "Electricity bill", category: "Utilities", amount: 24500 },
  { id: "e5", date: "2026-08-14", label: "Delivery van fuel", category: "Transport", amount: 18700 },
];
