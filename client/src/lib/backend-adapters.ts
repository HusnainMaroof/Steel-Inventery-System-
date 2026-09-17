import type {
  AttributeDef,
  AttributeOption,
  Customer,
  Expense,
  Payment,
  Product,
  ProductCategory,
  ProductItem,
  Purchase,
  Quality,
  Sale,
  StockCheck,
  Supplier,
  Variant,
  Warehouse,
  WarehouseLocation,
} from "./types";

type ApiLine = {
  productId: string;
  variantId?: string | null;
  categoryId?: string | null;
  purchaseId?: string | null;
  item: string;
  attributeSnapshot?: Record<string, string> | null;
  qualityName?: string | null;
  productName?: string | null;
  spec?: string | null;
  quality?: string | null;
  lotNumber?: string | null;
  heatNumber?: string | null;
  batchNumber?: string | null;
  warehouseId?: string | null;
  locationId?: string | null;
  qty: number;
  unit: string;
  rate: number;
  sellRate?: number | null;
};

type ApiPurchase = {
  id: string;
  date: string;
  supplierId: string;
  transport: number;
  loading: number;
  labour: number;
  otherCost: number;
  paid: number;
  lines: ApiLine[];
};

type ApiSale = {
  id: string;
  date: string;
  createdAt: string;
  customerId: string;
  discountPct: number;
  taxPct: number;
  loadingCharges: number;
  transportCharges: number;
  labourCharges: number;
  lines: ApiLine[];
  invoice?: { number: string } | null;
};

type ApiPayment = {
  id: string;
  date: string;
  type: "CUSTOMER" | "SUPPLIER";
  customerId?: string | null;
  supplierId?: string | null;
  amount: number;
  method: "CASH" | "BANK" | "CHEQUE";
  saleId?: string | null;
  note?: string | null;
};

type ApiExpense = Omit<Expense, "category"> & {
  category: "TRANSPORT" | "LABOR" | "RENT" | "UTILITIES" | "OTHER";
};

export type ApiBootstrap = {
  version: number;
  suppliers: Supplier[];
  customers: Customer[];
  purchases: ApiPurchase[];
  sales: ApiSale[];
  payments: ApiPayment[];
  expenses: ApiExpense[];
  stockChecks: StockCheck[];
  products: Product[];
  productItems: ProductItem[];
  categories: ProductCategory[];
  attributeDefs: AttributeDef[];
  attributeOptions: AttributeOption[];
  variants: Variant[];
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
};

const dateOnly = (value: string) => value.slice(0, 10);
const titleCase = <T extends string>(value: string) =>
  (value.charAt(0) + value.slice(1).toLowerCase()) as T;

export function normalizeBootstrap(raw: ApiBootstrap) {
  const purchaseById = new Map(raw.purchases.map((purchase) => [purchase.id, purchase]));
  const purchases: Purchase[] = raw.purchases.flatMap((purchase) =>
    purchase.lines.slice(0, 1).map((line) => ({
      id: purchase.id,
      date: dateOnly(purchase.date),
      supplierId: purchase.supplierId,
      product: line.productName ?? undefined,
      item: line.item,
      spec: line.spec ?? undefined,
      quality: line.quality ?? line.qualityName ?? undefined,
      categoryId: line.categoryId ?? undefined,
      variantId: line.variantId ?? undefined,
      attributeSnapshot: line.attributeSnapshot ?? undefined,
      lotNumber: line.lotNumber ?? undefined,
      heatNumber: line.heatNumber ?? undefined,
      batchNumber: line.batchNumber ?? undefined,
      warehouseId: line.warehouseId ?? undefined,
      locationId: line.locationId ?? undefined,
      qty: Number(line.qty),
      unit: line.unit,
      rate: Number(line.rate),
      transport: Number(purchase.transport),
      loadingCharges: Number(purchase.loading),
      labourCharges: Number(purchase.labour),
      otherCost: Number(purchase.otherCost),
      sellRate: line.sellRate == null ? undefined : Number(line.sellRate),
      paid: Number(purchase.paid),
    })),
  );

  const sales: Sale[] = raw.sales.map((sale) => ({
    id: sale.id,
    invoiceNo: sale.invoice?.number ?? sale.id,
    date: dateOnly(sale.date),
    createdAt: sale.createdAt,
    customerId: sale.customerId,
    discountPct: Number(sale.discountPct),
    taxPct: Number(sale.taxPct),
    loadingCharges: Number(sale.loadingCharges),
    transportCharges: Number(sale.transportCharges),
    labourCharges: Number(sale.labourCharges),
    lines: sale.lines.map((line) => ({
      item: line.item,
      qty: Number(line.qty),
      rate: Number(line.rate),
      unit: line.unit,
      qualityName: line.qualityName ?? undefined,
      purchaseId: line.purchaseId ?? undefined,
      supplierId: line.purchaseId
        ? purchaseById.get(line.purchaseId)?.supplierId
        : undefined,
      categoryId: line.categoryId ?? undefined,
      variantId: line.variantId ?? undefined,
      attributeSnapshot: line.attributeSnapshot ?? undefined,
    })),
  }));

  const payments: Payment[] = raw.payments.map((payment) => ({
    id: payment.id,
    date: dateOnly(payment.date),
    type: payment.type === "CUSTOMER" ? "customer" : "supplier",
    partyId:
      payment.type === "CUSTOMER"
        ? payment.customerId ?? ""
        : payment.supplierId ?? "",
    amount: Number(payment.amount),
    method: titleCase<Payment["method"]>(payment.method),
    saleId: payment.saleId ?? undefined,
    note: payment.note ?? undefined,
  }));

  const expenses: Expense[] = raw.expenses.map((expense) => ({
    ...expense,
    date: dateOnly(expense.date),
    amount: Number(expense.amount),
    category: titleCase<Expense["category"]>(expense.category),
  }));

  return {
    version: raw.version,
    suppliers: raw.suppliers,
    customers: raw.customers,
    purchases,
    sales,
    payments,
    expenses,
    stockChecks: raw.stockChecks.map((check) => ({
      ...check,
      date: dateOnly(check.date),
      physicalQty: Number(check.physicalQty),
    })),
    products: raw.products,
    productItems: raw.productItems,
    qualities: [] as Quality[],
    categories: raw.categories,
    attributeDefs: raw.attributeDefs,
    attributeOptions: raw.attributeOptions,
    variants: raw.variants,
    warehouses: raw.warehouses,
    locations: raw.locations,
    hiddenItems: [] as string[],
    hiddenVariants: [] as string[],
  };
}
