export type PaymentType = "customer" | "supplier";

/* single demo business today — every new record carries it so a real
   backend can isolate businesses later */
export const BUSINESS_ID = "biz-demo";

export interface Product {
  id: string;
  businessId?: string;
  name: string;
  unit: string; // base unit — e.g. "kg", "bag"; every quantity of this product is measured in it
  active?: boolean;
  /** @deprecated legacy secondary-list label (pre-dynamic-catalogue); kept for old surfaces */
  specLabel?: string;
}

export interface ProductItem {
  id: string;
  productId: string;
  name: string;
}

export interface Quality {
  id: string;
  productId?: string; // which product this grade fits (e.g. Grades for Steel); blank = fits any
  specOnly?: boolean; // true when this entry belongs to the product's spec list (e.g. Cement factories) rather than its quality list
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
  mill: string;
  phone: string;
}

export interface Customer {
  id: string;
  name: string;
  shop: string;
  phone: string;
}

export interface Purchase {
  id: string;
  date: string; // ISO yyyy-mm-dd
  supplierId: string;
  product?: string; // product name (e.g. "Rebar")
  item: string; // product item name (e.g. "Rebar 10mm")
  spec?: string; // product's own spec, e.g. Cement factory/mill ("Lucky Cement") — legacy mirror
  quality?: string; // quality grade (e.g. "60 Grade", "53 OPC") — legacy mirror
  // dynamic-catalogue identity (snapshot at entry — history never rewrites)
  categoryId?: string;
  variantId?: string;
  attributeSnapshot?: Record<string, string>; // attribute key -> option/value
  // lot-level traceability (optional)
  lotNumber?: string;
  heatNumber?: string;
  batchNumber?: string;
  warehouseId?: string;
  locationId?: string;
  qty: number; // in the product's own unit (kg, bag, …)
  unit: string; // product's unit, snapshot at entry (e.g. "kg", "bag")
  rate: number; // buying price PER UNIT of that unit
  transport: number;
  loadingCharges?: number; // loading/unloading charges for this lot (optional)
  labourCharges?: number; // labour cost for this lot (optional)
  otherCost: number;
  sellRate?: number; // your selling price per unit (planned)
  paid?: number; // amount already paid to the supplier
  lastPaidAt?: string; // date of the most recent payment (ISO yyyy-mm-dd)
  lastPaidAmount?: number; // amount paid in that most recent payment
  paymentHistory?: { date: string; amount: number }[]; // every payment, newest last
}

export interface SaleLine {
  item: string;
  qty: number; // in the product's own unit (kg, bag, …)
  rate: number; // selling price per unit of that unit
  unit: string; // product's unit, shown on the invoice
  spec?: string; // product's own spec, e.g. Cement factory ("Lucky Cement") — legacy mirror
  quality?: string; // quality grade sold (e.g. "60 Grade") — legacy mirror
  qualityName?: string; // quality name printed on the invoice (e.g. "60 Grade", "Bilzar")
  supplierId?: string; // which mill/supplier's stock this line came from
  purchaseId?: string; // the purchase lot this line was fulfilled from (exact source)
  // dynamic-catalogue identity (snapshot at sale time — history never rewrites)
  categoryId?: string;
  variantId?: string;
  attributeSnapshot?: Record<string, string>; // attribute key -> option/value
}

export interface Sale {
  id: string;
  invoiceNo: string;
  date: string; // sale date (ISO yyyy-mm-dd) — used for grouping/reports
  createdAt: string; // ISO datetime when the sale was recorded
  customerId: string;
  lines: SaleLine[];
  discountPct?: number; // invoice-wide discount percent (0 if absent)
  taxPct?: number; // invoice-wide sales tax percent (0 if absent)
  loadingCharges?: number; // invoice-wide loading charges (0 if absent)
  transportCharges?: number; // invoice-wide transport/freight charges (0 if absent)
  labourCharges?: number; // invoice-wide labour cost (0 if absent)
}

export interface Payment {
  id: string;
  date: string;
  type: PaymentType;
  partyId: string;
  amount: number;
  method: "Cash" | "Bank" | "Cheque";
  saleId?: string; // the specific invoice this payment settles (customer payments)
  note?: string;
}

export interface Expense {
  id: string;
  date: string;
  label: string;
  category: "Transport" | "Labor" | "Rent" | "Utilities" | "Other";
  amount: number;
}

export interface InventoryRow {
  item: string;
  product?: string; // product category (e.g. Rebar)
  spec?: string; // product's own spec, e.g. Cement factory ("Lucky Cement") — legacy mirror
  quality?: string; // quality grade, if set on purchases — legacy mirror
  unit?: string; // product's unit (kg, bag, …), derived from the product
  // dynamic-catalogue identity when available
  categoryId?: string;
  variantId?: string;
  attributeSnapshot?: Record<string, string>;
  supplierId?: string; // if set, this row is only that source's stock (else all sources)
  purchasedQty: number;
  soldQty: number;
  stockQty: number;
  totalCost: number;
  landedAvg: number;
  stockValue: number;
  avgSellRate: number; // realized average selling price (from sales)
  sellRate?: number; // recorded "Your Selling Price" on purchases (the invoice price)
}

// remaining stock of a single purchase lot, per source
export interface StockLot {
  purchaseId: string;
  item: string;
  product?: string;
  spec?: string; // product's own spec, e.g. Cement factory ("Lucky Cement") — legacy mirror
  quality?: string;
  supplierId: string;
  unit: string;
  remainingQty: number; // purchased qty minus qty already sold from this lot
  landedPerUnit: number; // actual landed cost per unit for this lot
  sellPrice?: number; // the "Your Selling Price" recorded on the purchase (per unit)
  purchasedAt: string;
  supplierName: string;
  // dynamic-catalogue identity + lot traceability
  categoryId?: string;
  variantId?: string;
  attributeSnapshot?: Record<string, string>;
  lotNumber?: string;
  heatNumber?: string;
  batchNumber?: string;
  warehouseId?: string;
  locationId?: string;
}

/* ================================================================
   Dynamic product hierarchy — configuration-driven catalogue.
   A business configures products → categories → attributes → options,
   and variants emerge from attribute combinations actually used.
   ================================================================ */

export type AttrType =
  | "text"
  | "number"
  | "select"
  | "boolean"
  | "date"
  | "measurement";

export interface ProductCategory {
  id: string;
  businessId: string;
  productId: string; // owning Product
  name: string; // e.g. "Rebar", "Grey Cement"
  active: boolean;
}

export interface AttributeDef {
  id: string;
  businessId: string;
  categoryId: string; // owning Category
  name: string; // human label, e.g. "Grade"
  key: string; // stable id used in attribute snapshots, e.g. "grade"
  type: AttrType;
  required: boolean; // must be set before a variant can be created/saved
  unit?: string; // for number/measurement, e.g. "mm", "kg"
  sortOrder: number;
  active: boolean;
}

export interface AttributeOption {
  id: string;
  attributeDefId: string;
  label: string; // shown in pickers and snapshots, e.g. "60 Grade"
  sortOrder: number;
  active: boolean;
}

/* one stockable/sellable combination of attribute values */
export interface Variant {
  id: string;
  businessId: string;
  categoryId: string;
  key: string; // deterministic: categoryId + sorted attribute key=value pairs
  attributes: Record<string, string>; // attribute key -> value (option label or typed value)
  shortName: string; // friendly one-line label used on rows, invoices and legacy mirrors
  active: boolean;
  createdAt: string; // ISO datetime when the variant first appeared
}

export interface Warehouse {
  id: string;
  businessId: string;
  name: string;
  active: boolean;
}

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  name: string;
  active: boolean;
}

/* every stock-affecting event type (transfers/returns/adjustments are
   reserved for later — today only purchase receipts and sales occur) */
export type MovementType =
  | "PURCHASE_RECEIPT"
  | "SALE"
  | "SALE_RETURN"
  | "PURCHASE_RETURN"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "DAMAGE"
  | "SCRAP";

/* derived view of every stock change (+ in, − out). Purchases and sales
   stay the authoritative records — this is a projection, not a second truth. */
export interface StockMovementView {
  id: string;
  type: MovementType;
  date: string;
  productId?: string;
  categoryId?: string;
  variantId?: string;
  attributeSnapshot?: Record<string, string>;
  unit: string;
  qty: number; // signed (+ in / − out)
  purchaseId?: string;
  saleId?: string;
  saleLineIndex?: number;
  supplierId?: string;
  warehouseId?: string;
  locationId?: string;
  refLabel?: string; // e.g. "LOT heat no", "INV-002"
}
