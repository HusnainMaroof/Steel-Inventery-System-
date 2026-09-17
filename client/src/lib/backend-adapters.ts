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
  StaffMember,
  Supplier,
  Variant,
  Warehouse,
  WarehouseLocation,
} from "./types";
import { parseDecimal } from "./decimal";
import { hydratePurchasePaymentHistories } from "./purchase-utils";
import { sanitizeAccess } from "./staff-access";
import { mergeUiPreferences, type UiPreferences } from "./ui-preferences";

type ApiLine = {
  id?: string;
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
  invoice?: { number: string; total: number; paid: number } | null;
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
  allocations?: { saleId: string; amount: number | string }[];
};

type ApiExpense = Omit<Expense, "category"> & {
  category: "TRANSPORT" | "LABOR" | "RENT" | "UTILITIES" | "OTHER";
};

type ApiStockCheck = Omit<StockCheck, "physicalQty" | "systemQty"> & {
  physicalQty: number | string;
  systemQty: number | string;
};

export type ApiBootstrap = {
  version: number;
  suppliers: Supplier[];
  customers: Customer[];
  purchases: ApiPurchase[];
  sales: ApiSale[];
  payments: ApiPayment[];
  expenses: ApiExpense[];
  stockChecks: ApiStockCheck[];
  products: Product[];
  productItems: ProductItem[];
  categories: ProductCategory[];
  attributeDefs: AttributeDef[];
  attributeOptions: AttributeOption[];
  variants: Variant[];
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  staff?: StaffMember[];
  settings?: Record<string, unknown>;
};

const dateOnly = (value: string) => value.slice(0, 10);
const titleCase = <T extends string>(value: string) =>
  (value.charAt(0) + value.slice(1).toLowerCase()) as T;

function expandPurchaseLines(purchase: ApiPurchase): Purchase[] {
  const lines = purchase.lines;
  if (lines.length === 0) return [];

  const goodsTotal = lines.reduce(
    (sum, line) => sum + parseDecimal(line.qty) * parseDecimal(line.rate),
    0,
  );
  const chargeTotal =
    parseDecimal(purchase.transport) +
    parseDecimal(purchase.loading) +
    parseDecimal(purchase.labour) +
    parseDecimal(purchase.otherCost);
  const paid = parseDecimal(purchase.paid);

  return lines.map((line, index) => {
    const lineGoods = parseDecimal(line.qty) * parseDecimal(line.rate);
    const share = goodsTotal > 0 ? lineGoods / goodsTotal : 1 / lines.length;
    const lineId = line.id ?? `${purchase.id}:${index}`;
    const rowId = lines.length === 1 ? purchase.id : `${purchase.id}::${lineId}`;

    return {
      id: rowId,
      purchaseId: purchase.id,
      lineId,
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
      qty: parseDecimal(line.qty),
      unit: line.unit,
      rate: parseDecimal(line.rate),
      transport: parseDecimal(purchase.transport) * share,
      loadingCharges: parseDecimal(purchase.loading) * share,
      labourCharges: parseDecimal(purchase.labour) * share,
      otherCost: parseDecimal(purchase.otherCost) * share,
      sellRate: line.sellRate == null ? undefined : parseDecimal(line.sellRate),
      paid,
    };
  });
}

export function mapApiSale(sale: ApiBootstrap["sales"][number]): Sale {
  return {
    id: sale.id,
    invoiceNo: sale.invoice?.number ?? sale.id,
    date: dateOnly(sale.date),
    createdAt: sale.createdAt,
    customerId: sale.customerId,
    discountPct: parseDecimal(sale.discountPct),
    taxPct: parseDecimal(sale.taxPct),
    loadingCharges: parseDecimal(sale.loadingCharges),
    transportCharges: parseDecimal(sale.transportCharges),
    labourCharges: parseDecimal(sale.labourCharges),
    invoicePaid: sale.invoice ? parseDecimal(sale.invoice.paid) : undefined,
    invoiceTotal: sale.invoice ? parseDecimal(sale.invoice.total) : undefined,
    lines: sale.lines.map((line) => ({
      item: line.item,
      qty: parseDecimal(line.qty),
      rate: parseDecimal(line.rate),
      unit: line.unit,
      qualityName: line.qualityName ?? undefined,
      purchaseId: line.purchaseId ?? undefined,
      categoryId: line.categoryId ?? undefined,
      variantId: line.variantId ?? undefined,
      attributeSnapshot: line.attributeSnapshot ?? undefined,
    })),
  };
}

export function normalizeBootstrap(raw: ApiBootstrap) {
  const purchaseById = new Map(raw.purchases.map((purchase) => [purchase.id, purchase]));
  let purchases: Purchase[] = raw.purchases.flatMap((purchase) =>
    expandPurchaseLines(purchase),
  );

  const sales: Sale[] = raw.sales.map((sale) => {
    const mapped = mapApiSale(sale);
    mapped.lines = mapped.lines.map((line) => ({
      ...line,
      supplierId: line.purchaseId
        ? purchaseById.get(line.purchaseId)?.supplierId
        : undefined,
    }));
    return mapped;
  });

  const payments: Payment[] = raw.payments.map((payment) => ({
    id: payment.id,
    date: dateOnly(payment.date),
    type: payment.type === "CUSTOMER" ? "customer" : "supplier",
    partyId:
      payment.type === "CUSTOMER"
        ? payment.customerId ?? ""
        : payment.supplierId ?? "",
    amount: parseDecimal(payment.amount),
    method: titleCase<Payment["method"]>(payment.method),
    saleId: payment.saleId ?? undefined,
    note: payment.note ?? undefined,
    allocations: payment.allocations?.map((a) => ({
      saleId: a.saleId,
      amount: parseDecimal(a.amount),
    })),
  }));

  purchases = hydratePurchasePaymentHistories(purchases, payments);

  const expenses: Expense[] = raw.expenses.map((expense) => ({
    ...expense,
    date: dateOnly(expense.date),
    amount: parseDecimal(expense.amount),
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
      physicalQty: parseDecimal(check.physicalQty),
      systemQty: parseDecimal(check.systemQty),
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
    staff: (raw.staff ?? []).map((member) => ({
      ...member,
      role: "SUBADMIN" as const,
      access: sanitizeAccess(member.access),
    })),
    settings: mergeUiPreferences(raw.settings as Partial<UiPreferences> | undefined),
    hiddenItems: [] as string[],
    hiddenVariants: [] as string[],
  };
}
