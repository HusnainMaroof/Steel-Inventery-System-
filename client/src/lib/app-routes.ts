const PUBLIC_PATHS = new Set(["/", "/login", "/offline", "/404"]);

const ADMIN_STATIC = new Set([
  "/admin",
  "/admin/overview",
  "/admin/businesses",
  "/admin/products",
  "/admin/subscriptions",
]);

const TENANT_TOP = new Set([
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
  "settings",
  "staff",
  "profit",
  "invoices",
  "audit",
]);

const DETAIL_SECTIONS = new Set(["purchases", "invoices", "sales"]);

export function isKnownAppPath(pathname: string): boolean {
  if (!pathname) return true;
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (ADMIN_STATIC.has(pathname)) return true;
  if (/^\/admin\/businesses\/[^/]+$/.test(pathname)) return true;

  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 1 && TENANT_TOP.has(parts[0])) return true;
  if (parts.length === 2 && parts[0] === "sales" && parts[1] === "print") return true;
  if (parts.length === 2 && DETAIL_SECTIONS.has(parts[0])) return true;

  if (parts.length >= 2) {
    const page = parts[1];
    if (!TENANT_TOP.has(page)) return false;
    const rest = parts.slice(2);
    if (rest.length === 0) return true;
    if (page === "sales" && rest.length === 1 && rest[0] === "print") return true;
    if (DETAIL_SECTIONS.has(page) && rest.length === 1) return true;
    return false;
  }

  return false;
}
