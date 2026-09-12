import type {
  AttributeDef,
  AttributeOption,
  Customer,
  Expense,
  Payment,
  Product,
  ProductCategory,
  Purchase,
  Sale,
  Supplier,
  Variant,
  Warehouse,
  WarehouseLocation,
} from "./types";
import { BUSINESS_ID } from "./types";
import { variantKey } from "./catalogue";

/*
 * Demo dataset: the product catalogue plus ~3 months of realistic trading
 * history (suppliers, customers, stock lots, invoices, payments, expenses).
 * Dates are computed relative to "today" so dashboards and reports always
 * show a recent, coherent period.
 */

const DAY = 86_400_000;
const dateAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
const createdAtAgo = (days: number, hour = 10, minute = 30) => {
  const d = new Date(Date.now() - days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

export const seedProducts: Product[] = [
  { id: "prod-steel", businessId: BUSINESS_ID, name: "Steel", unit: "kg", active: true },
  { id: "prod-wire", businessId: BUSINESS_ID, name: "Wire", unit: "kg", active: true },
  { id: "prod-cement", businessId: BUSINESS_ID, name: "Cement", unit: "bag", active: true },
];

export const seedCategories: ProductCategory[] = [
  { id: "cat-rebar", businessId: BUSINESS_ID, productId: "prod-steel", name: "Rebar", active: true },
  { id: "cat-wire-ba", businessId: BUSINESS_ID, productId: "prod-wire", name: "Black Annealed Binding Wire", active: true },
  { id: "cat-wire-gi", businessId: BUSINESS_ID, productId: "prod-wire", name: "G.I Wire", active: true },
  { id: "cat-cement-grey", businessId: BUSINESS_ID, productId: "prod-cement", name: "Grey Cement", active: true },
  { id: "cat-cement-white", businessId: BUSINESS_ID, productId: "prod-cement", name: "White Cement", active: true },
];

export const seedAttributeDefs: AttributeDef[] = [
  { id: "def-rebar-size", businessId: BUSINESS_ID, categoryId: "cat-rebar", name: "Size", key: "size", type: "select", required: true, sortOrder: 1, active: true },
  { id: "def-rebar-grade", businessId: BUSINESS_ID, categoryId: "cat-rebar", name: "Grade", key: "grade", type: "select", required: false, sortOrder: 2, active: true },
  { id: "def-wire-gauge", businessId: BUSINESS_ID, categoryId: "cat-wire-ba", name: "Gauge", key: "gauge", type: "select", required: true, sortOrder: 1, active: true },
  { id: "def-gi-gauge", businessId: BUSINESS_ID, categoryId: "cat-wire-gi", name: "Gauge", key: "gauge", type: "select", required: true, sortOrder: 1, active: true },
  { id: "def-grey-brand", businessId: BUSINESS_ID, categoryId: "cat-cement-grey", name: "Brand", key: "brand", type: "select", required: true, sortOrder: 1, active: true },
  { id: "def-grey-grade", businessId: BUSINESS_ID, categoryId: "cat-cement-grey", name: "Grade", key: "grade", type: "select", required: false, sortOrder: 2, active: true },
  { id: "def-white-brand", businessId: BUSINESS_ID, categoryId: "cat-cement-white", name: "Brand", key: "brand", type: "select", required: true, sortOrder: 1, active: true },
  { id: "def-white-grade", businessId: BUSINESS_ID, categoryId: "cat-cement-white", name: "Grade", key: "grade", type: "select", required: false, sortOrder: 2, active: true },
];

export const seedAttributeOptions: AttributeOption[] = [
  ...["2 Sutar", "3 Sutar", "4 Sutar", "5 Sutar", "6 Sutar", "8 Sutar"].map((label, i) => ({
    id: `opt-size-${i}`, attributeDefId: "def-rebar-size", label, sortOrder: i, active: true,
  })),
  ...["40 Grade", "60 Grade", "75 Grade"].map((label, i) => ({
    id: `opt-gsteel-${i}`, attributeDefId: "def-rebar-grade", label, sortOrder: i, active: true,
  })),
  ...["16 Gauge", "18 Gauge", "20 Gauge"].map((label, i) => ({
    id: `opt-gauge-ba-${i}`, attributeDefId: "def-wire-gauge", label, sortOrder: i, active: true,
  })),
  ...["16 Gauge", "18 Gauge", "20 Gauge"].map((label, i) => ({
    id: `opt-gauge-gi-${i}`, attributeDefId: "def-gi-gauge", label, sortOrder: i, active: true,
  })),
  ...["Lucky Cement", "Fauji Cement", "DG Khan Cement", "Maple Leaf Cement"].map((label, i) => ({
    id: `opt-brand-grey-${i}`, attributeDefId: "def-grey-brand", label, sortOrder: i, active: true,
  })),
  ...["Lucky Cement", "Fauji Cement", "DG Khan Cement", "Maple Leaf Cement"].map((label, i) => ({
    id: `opt-brand-white-${i}`, attributeDefId: "def-white-brand", label, sortOrder: i, active: true,
  })),
  ...["33 OPC", "43 OPC", "53 OPC"].map((label, i) => ({
    id: `opt-gcement-grey-${i}`, attributeDefId: "def-grey-grade", label, sortOrder: i, active: true,
  })),
  ...["33 OPC", "43 OPC", "53 OPC"].map((label, i) => ({
    id: `opt-gcement-white-${i}`, attributeDefId: "def-white-grade", label, sortOrder: i, active: true,
  })),
];

/* ---- warehouses ---- */

export const seedWarehouses: Warehouse[] = [
  { id: "wh-main", businessId: BUSINESS_ID, name: "Main Godown", active: true },
];

export const seedLocations: WarehouseLocation[] = [
  { id: "loc-steel", warehouseId: "wh-main", name: "Steel Bay", active: true },
  { id: "loc-cement", warehouseId: "wh-main", name: "Cement Bay", active: true },
];

/* ---- suppliers (mills we buy from) ---- */

export const seedSuppliers: Supplier[] = [
  { id: "sup-ittefaq", name: "Ittefaq Steel Mills", mill: "Ittefaq Group, Lahore", phone: "042-3766-2101" },
  { id: "sup-mughal", name: "Mughal Iron & Steel", mill: "Mughal Steel, Badami Bagh", phone: "042-3723-8845" },
  { id: "sup-dgkhan", name: "DG Khan Cement Depot", mill: "DG Khan Cement Co.", phone: "042-3781-5520" },
];

/* ---- customers (shops & contractors we sell to) ---- */

export const seedCustomers: Customer[] = [
  { id: "cust-alibaba", name: "Haji Akram", shop: "Al-Baba Hardware", phone: "0300-4412087" },
  { id: "cust-shahbaz", name: "M. Shahbaz", shop: "Shahbaz Steel House", phone: "0321-9903415" },
  { id: "cust-bilal", name: "Bilal Contractors", shop: "Bilal Construction, Ravi Road", phone: "0333-1127864" },
  { id: "cust-noor", name: "Noor & Sons", shop: "Noor Cement Agency", phone: "0301-7755902" },
  { id: "cust-tariq", name: "Tariq Mehmood", shop: "Tariq Traders, Shadbagh", phone: "0345-6681209" },
];

/* ---- variants (attribute combinations actually stocked) ---- */

const mkVariant = (
  id: string,
  categoryId: string,
  attributes: Record<string, string>,
  shortName: string,
  daysOld: number
): Variant => ({
  id,
  businessId: BUSINESS_ID,
  categoryId,
  key: variantKey(categoryId, attributes),
  attributes,
  shortName,
  active: true,
  createdAt: createdAtAgo(daysOld),
});

export const seedVariants: Variant[] = [
  mkVariant("var-rebar-3s60", "cat-rebar", { size: "3 Sutar", grade: "60 Grade" }, "3 Sutar · 60 Grade", 92),
  mkVariant("var-rebar-5s40", "cat-rebar", { size: "5 Sutar", grade: "40 Grade" }, "5 Sutar · 40 Grade", 92),
  mkVariant("var-rebar-8s75", "cat-rebar", { size: "8 Sutar", grade: "75 Grade" }, "8 Sutar · 75 Grade", 91),
  mkVariant("var-ba-18", "cat-wire-ba", { gauge: "18 Gauge" }, "18 Gauge", 90),
  mkVariant("var-ba-20", "cat-wire-ba", { gauge: "20 Gauge" }, "20 Gauge", 90),
  mkVariant("var-gi-16", "cat-wire-gi", { gauge: "16 Gauge" }, "16 Gauge", 89),
  mkVariant("var-grey-lucky53", "cat-cement-grey", { brand: "Lucky Cement", grade: "53 OPC" }, "Lucky Cement · 53 OPC", 92),
  mkVariant("var-grey-fauji43", "cat-cement-grey", { brand: "Fauji Cement", grade: "43 OPC" }, "Fauji Cement · 43 OPC", 92),
  mkVariant("var-white-dg53", "cat-cement-white", { brand: "DG Khan Cement", grade: "53 OPC" }, "DG Khan Cement · 53 OPC", 91),
];

/* ---- purchases (~3 months of stock lots) ---- */

type PurchaseSeed = Omit<Purchase, "id"> & { id: string };

const CATEGORY_OF: Record<string, string> = {
  "var-rebar-3s60": "cat-rebar",
  "var-rebar-5s40": "cat-rebar",
  "var-rebar-8s75": "cat-rebar",
  "var-ba-18": "cat-wire-ba",
  "var-ba-20": "cat-wire-ba",
  "var-gi-16": "cat-wire-gi",
  "var-grey-lucky53": "cat-cement-grey",
  "var-grey-fauji43": "cat-cement-grey",
  "var-white-dg53": "cat-cement-white",
};

const mkPurchase = (
  id: string,
  days: number,
  supplierId: string,
  variantId: string,
  item: string,
  product: string,
  attrs: Record<string, string>,
  qty: number,
  unit: string,
  rate: number,
  money: { transport: number; loading: number; labour: number; other: number; sellRate: number; paid: number },
  trace?: { locationId?: string; lotNumber?: string; heatNumber?: string; batchNumber?: string }
): PurchaseSeed => ({
  id,
  date: dateAgo(days),
  supplierId,
  product,
  item,
  categoryId: CATEGORY_OF[variantId],
  variantId,
  attributeSnapshot: attrs,
  quality: attrs.grade ?? attrs.gauge,
  spec: attrs.brand,
  ...(trace?.lotNumber ? { lotNumber: trace.lotNumber } : {}),
  ...(trace?.heatNumber ? { heatNumber: trace.heatNumber } : {}),
  ...(trace?.batchNumber ? { batchNumber: trace.batchNumber } : {}),
  warehouseId: "wh-main",
  locationId: trace?.locationId,
  qty,
  unit,
  rate,
  transport: money.transport,
  loadingCharges: money.loading || undefined,
  labourCharges: money.labour || undefined,
  otherCost: money.other,
  sellRate: money.sellRate,
  paid: money.paid,
  lastPaidAt: dateAgo(days),
  lastPaidAmount: money.paid,
  paymentHistory: money.paid > 0 ? [{ date: dateAgo(days), amount: money.paid }] : [],
});

export const seedPurchases: Purchase[] = [
  mkPurchase("pur-01", 88, "sup-ittefaq", "var-rebar-3s60", "3 Sutar · 60 Grade", "Steel", { size: "3 Sutar", grade: "60 Grade" },
    2000, "kg", 265, { transport: 15000, loading: 5000, labour: 4000, other: 0, sellRate: 295, paid: 530000 }, { locationId: "loc-steel", heatNumber: "H-88231" }),
  mkPurchase("pur-02", 82, "sup-mughal", "var-rebar-5s40", "5 Sutar · 40 Grade", "Steel", { size: "5 Sutar", grade: "40 Grade" },
    3000, "kg", 258, { transport: 18000, loading: 6000, labour: 5000, other: 0, sellRate: 288, paid: 400000 }, { locationId: "loc-steel", heatNumber: "M-51077" }),
  mkPurchase("pur-03", 75, "sup-ittefaq", "var-rebar-8s75", "8 Sutar · 75 Grade", "Steel", { size: "8 Sutar", grade: "75 Grade" },
    1500, "kg", 272, { transport: 12000, loading: 4500, labour: 3500, other: 0, sellRate: 302, paid: 408000 }, { locationId: "loc-steel", heatNumber: "H-88590" }),
  mkPurchase("pur-04", 70, "sup-dgkhan", "var-white-dg53", "DG Khan Cement · 53 OPC", "Cement", { brand: "DG Khan Cement", grade: "53 OPC" },
    400, "bag", 1420, { transport: 18000, loading: 3000, labour: 2500, other: 0, sellRate: 1560, paid: 568000 }, { locationId: "loc-cement", batchNumber: "DGW-4471" }),
  mkPurchase("pur-05", 64, "sup-ittefaq", "var-rebar-3s60", "3 Sutar · 60 Grade", "Steel", { size: "3 Sutar", grade: "60 Grade" },
    2500, "kg", 268, { transport: 15000, loading: 5000, labour: 4000, other: 0, sellRate: 298, paid: 500000 }, { locationId: "loc-steel", heatNumber: "H-89114" }),
  mkPurchase("pur-06", 58, "sup-mughal", "var-ba-18", "18 Gauge", "Wire", { gauge: "18 Gauge" },
    1200, "kg", 285, { transport: 9000, loading: 3000, labour: 2000, other: 0, sellRate: 315, paid: 342000 }, { locationId: "loc-steel", lotNumber: "LOT-B18-02" }),
  mkPurchase("pur-07", 52, "sup-dgkhan", "var-grey-lucky53", "Lucky Cement · 53 OPC", "Cement", { brand: "Lucky Cement", grade: "53 OPC" },
    600, "bag", 1385, { transport: 22000, loading: 4000, labour: 3000, other: 0, sellRate: 1520, paid: 500000 }, { locationId: "loc-cement", batchNumber: "LC-77342" }),
  mkPurchase("pur-08", 45, "sup-mughal", "var-gi-16", "16 Gauge", "Wire", { gauge: "16 Gauge" },
    800, "kg", 395, { transport: 7000, loading: 2500, labour: 2000, other: 0, sellRate: 435, paid: 316000 }, { locationId: "loc-steel", lotNumber: "LOT-GI16-01" }),
  mkPurchase("pur-09", 38, "sup-ittefaq", "var-rebar-5s40", "5 Sutar · 40 Grade", "Steel", { size: "5 Sutar", grade: "40 Grade" },
    2000, "kg", 262, { transport: 14000, loading: 5000, labour: 4500, other: 0, sellRate: 292, paid: 300000 }, { locationId: "loc-steel", heatNumber: "H-90412" }),
  mkPurchase("pur-10", 30, "sup-dgkhan", "var-grey-fauji43", "Fauji Cement · 43 OPC", "Cement", { brand: "Fauji Cement", grade: "43 OPC" },
    500, "bag", 1360, { transport: 16000, loading: 3500, labour: 2500, other: 0, sellRate: 1495, paid: 680000 }, { locationId: "loc-cement", batchNumber: "FC-30218" }),
  mkPurchase("pur-11", 24, "sup-mughal", "var-ba-20", "20 Gauge", "Wire", { gauge: "20 Gauge" },
    1000, "kg", 290, { transport: 8000, loading: 3000, labour: 2500, other: 0, sellRate: 320, paid: 200000 }, { locationId: "loc-steel", lotNumber: "LOT-B20-01" }),
  mkPurchase("pur-12", 18, "sup-ittefaq", "var-rebar-8s75", "8 Sutar · 75 Grade", "Steel", { size: "8 Sutar", grade: "75 Grade" },
    1200, "kg", 275, { transport: 10000, loading: 4000, labour: 3000, other: 0, sellRate: 305, paid: 330000 }, { locationId: "loc-steel", heatNumber: "H-91033" }),
  mkPurchase("pur-13", 12, "sup-dgkhan", "var-grey-lucky53", "Lucky Cement · 53 OPC", "Cement", { brand: "Lucky Cement", grade: "53 OPC" },
    700, "bag", 1395, { transport: 24000, loading: 4500, labour: 3500, other: 0, sellRate: 1530, paid: 600000 }, { locationId: "loc-cement", batchNumber: "LC-78115" }),
  mkPurchase("pur-14", 6, "sup-mughal", "var-rebar-3s60", "3 Sutar · 60 Grade", "Steel", { size: "3 Sutar", grade: "60 Grade" },
    1500, "kg", 270, { transport: 11000, loading: 4000, labour: 3500, other: 0, sellRate: 300, paid: 250000 }, { locationId: "loc-steel", heatNumber: "M-52460" }),
  mkPurchase("pur-15", 2, "sup-dgkhan", "var-white-dg53", "DG Khan Cement · 53 OPC", "Cement", { brand: "DG Khan Cement", grade: "53 OPC" },
    300, "bag", 1440, { transport: 14000, loading: 3000, labour: 2000, other: 0, sellRate: 1580, paid: 432000 }, { locationId: "loc-cement", batchNumber: "DGW-4590" }),
];

/* follow-up payments to mills (purchase `paid` above already includes these) */
const mkSupplierPayment = (id: string, days: number, partyId: string, amount: number, note: string): Payment => ({
  id, date: dateAgo(days), type: "supplier", partyId, amount, method: "Bank", note,
});

const supplierFollowUps: Payment[] = [
  mkSupplierPayment("pays-01", 40, "sup-mughal", 150000, "Part payment for 5 Sutar lot M-51077"),
  mkSupplierPayment("pays-02", 30, "sup-dgkhan", 200000, "Part payment for Lucky Cement batch LC-77342"),
  mkSupplierPayment("pays-03", 4, "sup-dgkhan", 250000, "Part payment for Lucky Cement batch LC-78115"),
];

/* ---- sales / invoices (chronological, INV-001 … INV-020) ---- */

type LineSeed = Sale["lines"][number];
const line = (
  variantId: string,
  item: string,
  categoryId: string,
  attrs: Record<string, string>,
  qty: number,
  rate: number,
  unit: string,
  qualityName?: string
): LineSeed => ({
  item, qty, rate, unit,
  quality: qualityName,
  qualityName: qualityName,
  categoryId,
  variantId,
  attributeSnapshot: attrs,
});

const mkSale = (
  id: string,
  invoiceNo: string,
  days: number,
  customerId: string,
  lines: LineSeed[],
  opts: { discountPct?: number; taxPct?: number; loading?: number; transport?: number; labour?: number } = {}
): Sale => ({
  id,
  invoiceNo,
  date: dateAgo(days),
  createdAt: createdAtAgo(days, 9 + (days % 8), (days * 13) % 60),
  customerId,
  lines,
  discountPct: opts.discountPct,
  taxPct: opts.taxPct,
  loadingCharges: opts.loading || undefined,
  transportCharges: opts.transport || undefined,
  labourCharges: opts.labour || undefined,
});

const R3S = { size: "3 Sutar", grade: "60 Grade" };
const R5S = { size: "5 Sutar", grade: "40 Grade" };
const R8S = { size: "8 Sutar", grade: "75 Grade" };
const BA18 = { gauge: "18 Gauge" };
const BA20 = { gauge: "20 Gauge" };
const GI16 = { gauge: "16 Gauge" };
const LUCKY53 = { brand: "Lucky Cement", grade: "53 OPC" };
const FAUJI43 = { brand: "Fauji Cement", grade: "43 OPC" };
const WHITE53 = { brand: "DG Khan Cement", grade: "53 OPC" };

export const seedSales: Sale[] = [
  mkSale("sale-01", "INV-001", 84, "cust-alibaba", [
    line("var-rebar-3s60", "3 Sutar · 60 Grade", "cat-rebar", R3S, 400, 295, "kg", "60 Grade"),
  ], { loading: 500, transport: 2000 }),
  mkSale("sale-02", "INV-002", 80, "cust-shahbaz", [
    line("var-rebar-5s40", "5 Sutar · 40 Grade", "cat-rebar", R5S, 600, 288, "kg", "40 Grade"),
  ]),
  mkSale("sale-03", "INV-003", 77, "cust-bilal", [
    line("var-white-dg53", "DG Khan Cement · 53 OPC", "cat-cement-white", WHITE53, 50, 1560, "bag", "53 OPC"),
  ], { loading: 300 }),
  mkSale("sale-04", "INV-004", 72, "cust-noor", [
    line("var-rebar-8s75", "8 Sutar · 75 Grade", "cat-rebar", R8S, 300, 302, "kg", "75 Grade"),
  ], { discountPct: 2, transport: 1500 }),
  mkSale("sale-05", "INV-005", 68, "cust-tariq", [
    line("var-ba-18", "18 Gauge", "cat-wire-ba", BA18, 200, 315, "kg"),
  ], { labour: 400 }),
  mkSale("sale-06", "INV-006", 63, "cust-alibaba", [
    line("var-rebar-3s60", "3 Sutar · 60 Grade", "cat-rebar", R3S, 500, 298, "kg", "60 Grade"),
  ], { loading: 600, transport: 2500 }),
  mkSale("sale-07", "INV-007", 59, "cust-shahbaz", [
    line("var-grey-lucky53", "Lucky Cement · 53 OPC", "cat-cement-grey", LUCKY53, 120, 1520, "bag", "53 OPC"),
  ], { discountPct: 1, transport: 3000 }),
  mkSale("sale-08", "INV-008", 55, "cust-bilal", [
    line("var-gi-16", "16 Gauge", "cat-wire-gi", GI16, 150, 435, "kg", "16 Gauge"),
  ]),
  mkSale("sale-09", "INV-009", 50, "cust-noor", [
    line("var-rebar-5s40", "5 Sutar · 40 Grade", "cat-rebar", R5S, 450, 292, "kg", "40 Grade"),
  ], { labour: 500 }),
  mkSale("sale-10", "INV-010", 46, "cust-tariq", [
    line("var-grey-fauji43", "Fauji Cement · 43 OPC", "cat-cement-grey", FAUJI43, 80, 1495, "bag", "43 OPC"),
  ], { loading: 250 }),
  mkSale("sale-11", "INV-011", 42, "cust-alibaba", [
    line("var-rebar-8s75", "8 Sutar · 75 Grade", "cat-rebar", R8S, 200, 302, "kg", "75 Grade"),
  ], { transport: 1200 }),
  mkSale("sale-12", "INV-012", 36, "cust-shahbaz", [
    line("var-ba-18", "18 Gauge", "cat-wire-ba", BA18, 300, 315, "kg"),
  ]),
  mkSale("sale-13", "INV-013", 32, "cust-bilal", [
    line("var-grey-lucky53", "Lucky Cement · 53 OPC", "cat-cement-grey", LUCKY53, 150, 1520, "bag", "53 OPC"),
  ], { discountPct: 2, loading: 400, labour: 300 }),
  mkSale("sale-14", "INV-014", 28, "cust-noor", [
    line("var-rebar-3s60", "3 Sutar · 60 Grade", "cat-rebar", R3S, 350, 298, "kg", "60 Grade"),
  ]),
  mkSale("sale-15", "INV-015", 25, "cust-tariq", [
    line("var-gi-16", "16 Gauge", "cat-wire-gi", GI16, 120, 435, "kg", "16 Gauge"),
  ], { transport: 800 }),
  mkSale("sale-16", "INV-016", 20, "cust-alibaba", [
    line("var-ba-20", "20 Gauge", "cat-wire-ba", BA20, 250, 320, "kg"),
  ], { labour: 350 }),
  mkSale("sale-17", "INV-017", 15, "cust-shahbaz", [
    line("var-rebar-5s40", "5 Sutar · 40 Grade", "cat-rebar", R5S, 700, 292, "kg", "40 Grade"),
  ], { discountPct: 1.5, loading: 700, transport: 3000 }),
  mkSale("sale-18", "INV-018", 10, "cust-bilal", [
    line("var-grey-fauji43", "Fauji Cement · 43 OPC", "cat-cement-grey", FAUJI43, 100, 1495, "bag", "43 OPC"),
  ]),
  mkSale("sale-19", "INV-019", 7, "cust-noor", [
    line("var-grey-lucky53", "Lucky Cement · 53 OPC", "cat-cement-grey", LUCKY53, 200, 1520, "bag", "53 OPC"),
  ], { taxPct: 5, transport: 4000 }),
  mkSale("sale-20", "INV-020", 3, "cust-tariq", [
    line("var-rebar-8s75", "8 Sutar · 75 Grade", "cat-rebar", R8S, 150, 305, "kg", "75 Grade"),
    line("var-white-dg53", "DG Khan Cement · 53 OPC", "cat-cement-white", WHITE53, 30, 1580, "bag", "53 OPC"),
  ], { loading: 500 }),
];

/* ---- customer payments (explicit per-invoice; keeps dues realistic) ---- */

const mkCustomerPayment = (
  id: string, days: number, partyId: string, amount: number, saleId?: string, note?: string
): Payment => ({
  id, date: dateAgo(days), type: "customer", partyId, amount, method: "Cash", saleId, note,
});

const customerPayments: Payment[] = [
  mkCustomerPayment("payc-01", 84, "cust-alibaba", 100000, "sale-01", "Paid at time of sale"),
  mkCustomerPayment("payc-02", 60, "cust-alibaba", 20500, "sale-01", "Balance settlement"),
  mkCustomerPayment("payc-03", 80, "cust-shahbaz", 172800, "sale-02", "Paid at time of sale"),
  mkCustomerPayment("payc-04", 77, "cust-bilal", 78300, "sale-03", "Paid at time of sale"),
  mkCustomerPayment("payc-05", 72, "cust-noor", 60000, "sale-04", "Paid at time of sale"),
  mkCustomerPayment("payc-06", 50, "cust-noor", 30288, "sale-04", "Balance settlement"),
  mkCustomerPayment("payc-07", 68, "cust-tariq", 63400, "sale-05", "Paid at time of sale"),
  mkCustomerPayment("payc-08", 63, "cust-alibaba", 100000, "sale-06", "Paid at time of sale"),
  mkCustomerPayment("payc-09", 59, "cust-shahbaz", 183576, "sale-07", "Paid at time of sale"),
  mkCustomerPayment("payc-10", 55, "cust-bilal", 65250, "sale-08", "Paid at time of sale"),
  mkCustomerPayment("payc-11", 50, "cust-noor", 80000, "sale-09", "Paid at time of sale"),
  mkCustomerPayment("payc-12", 20, "cust-noor", 51900, "sale-09", "Balance settlement"),
  mkCustomerPayment("payc-13", 46, "cust-tariq", 119850, "sale-10", "Paid at time of sale"),
  mkCustomerPayment("payc-14", 42, "cust-alibaba", 61600, "sale-11", "Paid at time of sale"),
  mkCustomerPayment("payc-15", 36, "cust-shahbaz", 60000, "sale-12", "Paid at time of sale"),
  mkCustomerPayment("payc-16", 32, "cust-bilal", 150000, "sale-13", "Paid at time of sale"),
  mkCustomerPayment("payc-17", 28, "cust-noor", 104300, "sale-14", "Paid at time of sale"),
  mkCustomerPayment("payc-18", 25, "cust-tariq", 53000, "sale-15", "Paid at time of sale"),
  mkCustomerPayment("payc-19", 20, "cust-alibaba", 50000, "sale-16", "Paid at time of sale"),
  mkCustomerPayment("payc-20", 15, "cust-shahbaz", 100000, "sale-17", "Paid at time of sale"),
  mkCustomerPayment("payc-21", 10, "cust-bilal", 149500, "sale-18", "Paid at time of sale"),
  mkCustomerPayment("payc-22", 7, "cust-noor", 200000, "sale-19", "Paid at time of sale"),
  mkCustomerPayment("payc-23", 3, "cust-tariq", 40000, "sale-20", "Paid at time of sale"),
  mkCustomerPayment("payc-24", 1, "cust-tariq", 30000, "sale-20", "Part payment"),
];

export const seedPayments: Payment[] = [...customerPayments, ...supplierFollowUps];

/* ---- business expenses ---- */

export const seedExpenses: Expense[] = [
  { id: "exp-01", date: dateAgo(85), label: "Godown rent — month 1", category: "Rent", amount: 40000 },
  { id: "exp-02", date: dateAgo(70), label: "Electricity bill", category: "Utilities", amount: 12000 },
  { id: "exp-03", date: dateAgo(55), label: "Staff salaries", category: "Labor", amount: 85000 },
  { id: "exp-04", date: dateAgo(40), label: "Electricity bill", category: "Utilities", amount: 13500 },
  { id: "exp-05", date: dateAgo(25), label: "Staff salaries", category: "Labor", amount: 85000 },
  { id: "exp-06", date: dateAgo(18), label: "Truck maintenance", category: "Transport", amount: 9000 },
  { id: "exp-07", date: dateAgo(10), label: "Electricity bill", category: "Utilities", amount: 14000 },
];

export const seedInitialState = {
  suppliers: seedSuppliers,
  customers: seedCustomers,
  purchases: seedPurchases,
  sales: seedSales,
  payments: seedPayments,
  expenses: seedExpenses,
  products: seedProducts,
  productItems: [],
  qualities: [],
  categories: seedCategories,
  attributeDefs: seedAttributeDefs,
  attributeOptions: seedAttributeOptions,
  variants: seedVariants,
  warehouses: seedWarehouses,
  locations: seedLocations,
};
