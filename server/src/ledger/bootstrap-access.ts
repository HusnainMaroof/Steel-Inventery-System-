import type { StaffPage } from "../common/staff-access";
import { sanitizeAccess } from "../common/staff-access";

type BootstrapPayload = Record<string, unknown>;

function has(access: Set<StaffPage>, page: StaffPage) {
  return access.has(page);
}

/** Payments page sees every cash row. Sales can still see money received.
 *  Purchases can still see money paid. */
function paymentsForAccess(rows: unknown, can: (page: StaffPage) => boolean): unknown[] {
  const list = Array.isArray(rows) ? rows : [];
  if (can("payments")) return list;
  return list.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const type = (row as { type?: string }).type;
    if (type === "CUSTOMER") return can("sales");
    if (type === "SUPPLIER") return can("purchases");
    return false;
  });
}

/** Strip bootstrap collections staff should not receive (mirrors API page guards). */
export function filterBootstrapForStaff(
  data: BootstrapPayload,
  access: string[] | undefined,
): BootstrapPayload {
  const allowed = new Set(sanitizeAccess(access));
  const can = (page: StaffPage) => has(allowed, page);
  const salesContext = can("sales") || can("purchases");

  return {
    ...data,
    suppliers: can("suppliers") || can("purchases") ? data.suppliers : [],
    customers: can("customers") || salesContext ? data.customers : [],
    purchases: can("purchases") ? data.purchases : [],
    sales: can("sales") ? data.sales : [],
    payments: paymentsForAccess(data.payments, can),
    expenses: can("expenses") ? (data.expenses ?? []) : [],
    stockChecks: can("inventory") ? data.stockChecks : [],
    products:
      can("products") || can("inventory") || salesContext ? data.products : [],
    productItems:
      can("products") || can("inventory") || salesContext ? data.productItems : [],
    categories:
      can("products") || can("inventory") || salesContext ? data.categories : [],
    attributeDefs:
      can("products") || can("inventory") || salesContext ? data.attributeDefs : [],
    attributeOptions:
      can("products") || can("inventory") || salesContext ? data.attributeOptions : [],
    variants:
      can("products") || can("inventory") || salesContext ? data.variants : [],
    warehouses: can("inventory") ? data.warehouses : [],
    locations: can("inventory") ? data.locations : [],
    staff: [],
    settings: data.settings ?? {},
  };
}

export type StaffTransactionPayload = {
  customers: unknown[];
  suppliers: unknown[];
  purchases: unknown[];
  sales: unknown[];
  payments: unknown[];
  expenses: unknown[];
  stockChecks: unknown[];
};

/** Same access rules as bootstrap — staff only receive rows for allowed modules. */
export function filterTransactionsForStaff(
  data: StaffTransactionPayload,
  access: string[] | undefined,
): StaffTransactionPayload {
  const allowed = new Set(sanitizeAccess(access));
  const can = (page: StaffPage) => has(allowed, page);
  const salesContext = can("sales") || can("purchases");

  return {
    customers: can("customers") || salesContext ? data.customers : [],
    suppliers: can("suppliers") || can("purchases") ? data.suppliers : [],
    purchases: can("purchases") ? data.purchases : [],
    sales: can("sales") ? data.sales : [],
    payments: paymentsForAccess(data.payments, can),
    expenses: can("expenses") ? (data.expenses ?? []) : [],
    stockChecks: can("inventory") ? data.stockChecks : [],
  };
}
