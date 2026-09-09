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

/*
 * Fresh start: only the product catalogue is seeded — products, categories,
 * attributes and options. Everything else (stock, sales, parties) is empty
 * until the owner records real transactions.
 */

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

export const seedVariants: Variant[] = [];
export const seedWarehouses: Warehouse[] = [];
export const seedLocations: WarehouseLocation[] = [];
export const seedSuppliers: Supplier[] = [];
export const seedCustomers: Customer[] = [];
export const seedPurchases: Purchase[] = [];
export const seedSales: Sale[] = [];
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
  productItems: [],
  qualities: [],
  categories: seedCategories,
  attributeDefs: seedAttributeDefs,
  attributeOptions: seedAttributeOptions,
  variants: seedVariants,
  warehouses: seedWarehouses,
  locations: seedLocations,
};
