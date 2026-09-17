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
    { key: "settings" as const, href: businessPath(slug, "settings"), label: "Settings" },
  ];
}

export const APP_PAGES = navPagesFor("shop");

export function allStaffPages(): StaffPage[] {
  return [...STAFF_PAGES];
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

export function pageLabel(key: StaffPage): string {
  return APP_PAGES.find((p) => p.key === key)?.label ?? key;
}

export function accessSummary(access: StaffPage[]): string {
  if (!access.length) return "No pages";
  return access.map(pageLabel).join(", ");
}

export function pagesFor(user: Pick<TradexUser, "role" | "access" | "businessSlug">) {
  const slug = user.businessSlug;
  const pages = navPagesFor(slug);
  if (user.role === "ADMIN") {
    return [
      ...pages,
      { key: "staff" as const, href: businessPath(slug, "staff"), label: "Staff" },
    ];
  }
  const allowed = new Set(sanitizeAccess(user.access));
  return pages.filter(
    (p) => (STAFF_PAGES as readonly string[]).includes(p.key) && allowed.has(p.key as StaffPage),
  );
}

export function homePathFor(user: Pick<TradexUser, "role" | "access" | "businessSlug"> | null | undefined): string {
  if (!user) return "/login";
  if (user.role === "SUPERADMIN") return "/admin";
  const first = pagesFor(user)[0];
  return first?.href ?? businessPath(user.businessSlug, "dashboard");
}

function staffPageKey(path: string): StaffPage | "staff" | "settings" | null {
  const segment = path.replace(/^\/+/, "").split("/")[0] ?? "";
  if (segment === "staff" || segment === "settings") return segment;
  if ((STAFF_PAGES as readonly string[]).includes(segment)) return segment as StaffPage;
  if (segment === "sales" || segment === "purchases" || segment === "invoices") {
    const root = segment as StaffPage;
    return (STAFF_PAGES as readonly string[]).includes(root) ? root : "sales";
  }
  return null;
}

export function canOpenPath(
  user: Pick<TradexUser, "role" | "access" | "businessSlug"> | null | undefined,
  pathname: string,
): boolean {
  if (!user) return false;
  const admin = pathname === "/admin" || pathname.startsWith("/admin/");
  if (user.role === "SUPERADMIN") return admin;

  if (admin) return false;

  const slug = businessSlugFromPath(pathname);
  if (!slug) return false;
  if (slug !== user.businessSlug) return false;

  const pagePath = pagePathFromBusinessRoute(pathname) ?? "/dashboard";
  if (user.role === "ADMIN") return true;

  const key = staffPageKey(pagePath);
  if (!key || key === "staff" || key === "settings") return false;
  return sanitizeAccess(user.access).includes(key);
}

export type AccessUser = Pick<TradexUser, "role" | "access" | "businessSlug">;
