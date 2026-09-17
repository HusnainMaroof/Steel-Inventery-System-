import { STAFF_PAGES } from "./staff-access";

export const BUSINESS_PANEL_PAGES = [
  ...STAFF_PAGES,
  "staff",
  "settings",
] as const;

export type BusinessPanelPage = (typeof BUSINESS_PANEL_PAGES)[number];

export const ALL_BUSINESS_PANEL_PAGES: BusinessPanelPage[] = [...BUSINESS_PANEL_PAGES];

const PANEL_LABELS: Record<BusinessPanelPage, string> = {
  dashboard: "Dashboard",
  purchases: "Purchases",
  products: "Products",
  inventory: "Inventory",
  sales: "Sales & Invoices",
  customers: "Customers",
  suppliers: "Mills / Suppliers",
  payments: "Payments",
  expenses: "Expenses",
  reports: "Profit & Reports",
  staff: "Staff",
  settings: "Settings",
};

export function sanitizePlanPages(pages: string[] | undefined): BusinessPanelPage[] {
  if (!pages?.length) return [...ALL_BUSINESS_PANEL_PAGES];
  const allowed = new Set<string>(BUSINESS_PANEL_PAGES);
  const out: BusinessPanelPage[] = [];
  for (const page of pages) {
    if (allowed.has(page) && !out.includes(page as BusinessPanelPage)) {
      out.push(page as BusinessPanelPage);
    }
  }
  return out.length ? out : [...ALL_BUSINESS_PANEL_PAGES];
}

export function panelPageLabel(key: BusinessPanelPage): string {
  return PANEL_LABELS[key] ?? key;
}
