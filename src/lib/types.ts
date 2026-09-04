export type PaymentType = "customer" | "supplier";

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
  item: string;
  qty: number; // tons
  rate: number; // mill price per ton
  transport: number;
  otherCost: number;
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
  purchasedQty: number;
  soldQty: number;
  stockQty: number;
  totalCost: number;
  landedAvg: number;
  stockValue: number;
  avgSellRate: number;
}
