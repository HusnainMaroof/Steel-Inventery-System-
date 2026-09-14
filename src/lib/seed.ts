import type {
  AttributeDef,
  AttributeOption,
  Product,
  ProductCategory,
  Variant,
  Warehouse,
  WarehouseLocation,
} from "./types";
import { BUSINESS_ID } from "./types";
import { variantKey } from "./catalogue";

/*
 * Starter dataset: just the product catalogue (products, categories,
 * attribute definitions and options, stocked variants) plus warehouse
 * structure. No demo trading history — suppliers, customers, purchases,
 * sales, payments and expenses all start empty.
 */

const DAY = 86_400_000;
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
  mkVariant("var-rebar-3s60", "cat-rebar", { size: "3 Sutar", grade: "60 Grade" }, "3 Sutar · 60 Grade", 0),
  mkVariant("var-rebar-5s40", "cat-rebar", { size: "5 Sutar", grade: "40 Grade" }, "5 Sutar · 40 Grade", 0),
  mkVariant("var-rebar-8s75", "cat-rebar", { size: "8 Sutar", grade: "75 Grade" }, "8 Sutar · 75 Grade", 0),
  mkVariant("var-ba-18", "cat-wire-ba", { gauge: "18 Gauge" }, "18 Gauge", 0),
  mkVariant("var-ba-20", "cat-wire-ba", { gauge: "20 Gauge" }, "20 Gauge", 0),
  mkVariant("var-gi-16", "cat-wire-gi", { gauge: "16 Gauge" }, "16 Gauge", 0),
  mkVariant("var-grey-lucky53", "cat-cement-grey", { brand: "Lucky Cement", grade: "53 OPC" }, "Lucky Cement · 53 OPC", 0),
  mkVariant("var-grey-fauji43", "cat-cement-grey", { brand: "Fauji Cement", grade: "43 OPC" }, "Fauji Cement · 43 OPC", 0),
  mkVariant("var-white-dg53", "cat-cement-white", { brand: "DG Khan Cement", grade: "53 OPC" }, "DG Khan Cement · 53 OPC", 0),
];

export const seedInitialState = {
  suppliers: [],
  customers: [],
  purchases: [],
  sales: [],
  payments: [],
  expenses: [],
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
