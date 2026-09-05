export type PaymentType = "customer" | "supplier";

export interface Product {
  id: string;
  name: string;
}

export interface ProductItem {
  id: string;
  productId: string;
  name: string;
}

export interface Quality {
  id: string;
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
  quality?: string; // quality name (e.g. "Grade A")
  qty: number; // always stored in TONS internally (kg entries are divided by 1000)
  unit?: "ton" | "kg"; // unit the user entered with; defaults to "ton"
  rate: number; // buying price PER TON (kg entries are multiplied by 1000)
  transport: number;
  otherCost: number;
  sellRate?: number; // your selling price per ton (planned)
  paid?: number; // amount already paid to the supplier
  lastPaidAt?: string; // date of the most recent payment (ISO yyyy-mm-dd)
  lastPaidAmount?: number; // amount paid in that most recent payment
  paymentHistory?: { date: string; amount: number }[]; // every payment, newest last
}

export interface SaleLine {
  item: string;
  qty: number;
  rate: number; // selling price per ton
}

export interface Sale {
  id: string;
  invoiceNo: string;
  date: string;
  customerId: string;
  lines: SaleLine[];
}

export interface Payment {
  id: string;
  date: string;
  type: PaymentType;
  partyId: string;
  amount: number;
  method: "Cash" | "Bank" | "Cheque";
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
  quality?: string; // quality grade, if set on purchases
  unit?: "ton" | "kg"; // display unit from the item's purchases
  purchasedQty: number;
  soldQty: number;
  stockQty: number;
  totalCost: number;
  landedAvg: number;
  stockValue: number;
  avgSellRate: number;
}
