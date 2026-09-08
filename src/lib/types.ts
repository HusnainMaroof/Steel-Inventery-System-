export type PaymentType = "customer" | "supplier";

export interface Product {
  id: string;
  name: string;
  unit: string; // e.g. "kg", "bag" — every quantity of this product is measured in it
  specLabel?: string; // what its secondary list means, e.g. "Factory / Mill" for Cement; default "Quality"
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
  spec?: string; // product's own spec, e.g. Cement factory/mill ("Lucky Cement")
  quality?: string; // quality grade (e.g. "60 Grade", "53 OPC")
  qty: number; // in the product's own unit (kg, bag, …)
  unit: string; // product's unit, snapshot at entry (e.g. "kg", "bag")
  rate: number; // buying price PER UNIT of that unit
  transport: number;
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
  spec?: string; // product's own spec, e.g. Cement factory ("Lucky Cement")
  quality?: string; // quality grade sold (e.g. "60 Grade")
  supplierId?: string; // which mill/supplier's stock this line came from
  purchaseId?: string; // the purchase lot this line was fulfilled from (exact source)
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
  spec?: string; // product's own spec, e.g. Cement factory ("Lucky Cement")
  quality?: string; // quality grade, if set on purchases
  unit?: string; // product's unit (kg, bag, …), derived from the product
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
  spec?: string; // product's own spec, e.g. Cement factory ("Lucky Cement")
  quality?: string;
  supplierId: string;
  unit: string;
  remainingQty: number; // purchased qty minus qty already sold from this lot
  landedPerUnit: number; // actual landed cost per unit for this lot
  sellPrice?: number; // the "Your Selling Price" recorded on the purchase (per unit)
  purchasedAt: string;
  supplierName: string;
}
