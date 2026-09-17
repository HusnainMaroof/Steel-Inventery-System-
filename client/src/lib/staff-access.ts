import type { TradexRole, TradexUser } from "./auth-types";
import { businessPath, businessSlugFromPath, pagePathFromBusinessRoute } from "./business-path";

export const STAFF_PAGES = [
  "dashboard",
  "purchases",
  "products",
  "inventory",
  "sales",
  "customers",
  "suppliers",
  "payments",
  "expenses",
  "reports",
] as const;

export type StaffPage = (typeof STAFF_PAGES)[number];

export const BUSINESS_PANEL_PAGES = [
  ...STAFF_PAGES,
  "staff",
  "settings",
] as const;

export type BusinessPanelPage = (typeof BUSINESS_PANEL_PAGES)[number];

export const STAFF_TITLE_PRESETS = [
  "Sales manager",
  "Store keeper",
  "Accountant",
  "Purchase manager",
  "Inventory clerk",
] as const;

export function navPagesFor(slug: string) {
  return [
    { key: "dashboard" as const, href: businessPath(slug, "dashboard"), label: "Dashboard" },
    { key: "purchases" as const, href: businessPath(slug, "purchases"), label: "Purchases" },
    { key: "products" as const, href: businessPath(slug, "products"), label: "Products" },
    { key: "inventory" as const, href: businessPath(slug, "inventory"), label: "Inventory" },
    { key: "sales" as const, href: businessPath(slug, "sales"), label: "Sales & Invoices" },
    { key: "customers" as const, href: businessPath(slug, "customers"), label: "Customers" },
    { key: "suppliers" as const, href: businessPath(slug, "suppliers"), label: "Mills / Suppliers" },
    { key: "payments" as const, href: businessPath(slug, "payments"), label: "Payments" },
    { key: "expenses" as const, href: businessPath(slug, "expenses"), label: "Expenses" },
    { key: "reports" as const, href: businessPath(slug, "reports"), label: "Profit & Reports" },
    { key: "staff" as const, href: businessPath(slug, "staff"), label: "Staff" },
    { key: "settings" as const, href: businessPath(slug, "settings"), label: "Settings" },
  ];
}

export const APP_PAGES = navPagesFor("shop");

export function allStaffPages(): StaffPage[] {
  return [...STAFF_PAGES];
}

export function allBusinessPanelPages(): BusinessPanelPage[] {
  return [...BUSINESS_PANEL_PAGES];
}

export function sanitizeAccess(pages: string[] | undefined): StaffPage[] {
  if (!pages?.length) return [];
  const allowed = new Set<string>(STAFF_PAGES);
  const out: StaffPage[] = [];
  for (const page of pages) {
    if (allowed.has(page) && !out.includes(page as StaffPage)) {
      out.push(page as StaffPage);
    }
  }
  return out;
}

export function sanitizePlanPages(pages: string[] | undefined): BusinessPanelPage[] {
  if (!pages?.length) return allBusinessPanelPages();
  const allowed = new Set<string>(BUSINESS_PANEL_PAGES);
  const out: BusinessPanelPage[] = [];
  for (const page of pages) {
    if (allowed.has(page) && !out.includes(page as BusinessPanelPage)) {
      out.push(page as BusinessPanelPage);
    }
  }
  return out.length ? out : allBusinessPanelPages();
}

function planPageSet(pages?: BusinessPanelPage[]): Set<BusinessPanelPage> {
  return new Set(sanitizePlanPages(pages));
}

export function pageLabel(key: StaffPage): string {
  return APP_PAGES.find((p) => p.key === key)?.label ?? key;
}

export function panelPageLabel(key: BusinessPanelPage): string {
  if (key === "staff") return "Staff";
  if (key === "settings") return "Settings";
  return pageLabel(key as StaffPage);
}

export function accessSummary(access: StaffPage[]): string {
  if (!access.length) return "No pages";
  return access.map(pageLabel).join(", ");
}

export function planPagesSummary(pages?: BusinessPanelPage[]): string {
  const list = sanitizePlanPages(pages);
  if (list.length === allBusinessPanelPages().length) return "All modules";
  return list.map(panelPageLabel).join(", ");
}

type NavUser = Pick<TradexUser, "role" | "access" | "businessSlug" | "planPages">;

export function pagesFor(user: NavUser) {
  const slug = user.businessSlug;
  const pages = navPagesFor(slug);
  const plan = planPageSet(user.planPages);

  const filtered = pages.filter((page) => plan.has(page.key as BusinessPanelPage));

  if (user.role === "ADMIN") return filtered;

  const allowed = new Set(sanitizeAccess(user.access));
  return filtered.filter(
    (page) =>
      (STAFF_PAGES as readonly string[]).includes(page.key) &&
      allowed.has(page.key as StaffPage),
  );
}

export function homePathFor(user: NavUser | null | undefined): string {
  if (!user) return "/login";
  if (user.role === "SUPERADMIN") return "/admin/overview";
  const first = pagesFor(user)[0];
  return first?.href ?? businessPath(user.businessSlug, "dashboard");
}

function staffPageKey(path: string): BusinessPanelPage | null {
  const segment = path.replace(/^\/+/, "").split("/")[0] ?? "";
  if ((BUSINESS_PANEL_PAGES as readonly string[]).includes(segment)) {
    return segment as BusinessPanelPage;
  }
  if (segment === "sales" || segment === "purchases" || segment === "invoices") {
    if (segment === "invoices") return "sales";
    return segment as BusinessPanelPage;
  }
  if (segment === "profit") return "reports";
  return null;
}

export function canOpenPath(user: NavUser | null | undefined, pathname: string): boolean {
  if (!user) return false;
  const admin = pathname === "/admin" || pathname.startsWith("/admin/");
  if (user.role === "SUPERADMIN") return admin;

  if (admin) return false;

  const slug = businessSlugFromPath(pathname);
  if (!slug) return false;
  if (slug !== user.businessSlug) return false;

  const pagePath = pagePathFromBusinessRoute(pathname) ?? "/dashboard";
  const key = staffPageKey(pagePath);
  if (!key) return true;

  const plan = planPageSet(user.planPages);
  if (!plan.has(key)) return false;

  if (user.role === "ADMIN") return true;

  if (key === "staff" || key === "settings") return false;
  return sanitizeAccess(user.access).includes(key as StaffPage);
}

export type AccessUser = Pick<TradexUser, "role" | "access" | "businessSlug" | "planPages">;
