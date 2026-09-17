import type { StaffPage } from "../common/staff-access";
import { sanitizeAccess } from "../common/staff-access";

type BootstrapPayload = Record<string, unknown>;

function has(access: Set<StaffPage>, page: StaffPage) {
  return access.has(page);
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
    payments: can("payments") ? data.payments : [],
    expenses: can("expenses") ? data.expenses : [],
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
    settings: {},
  };
}
