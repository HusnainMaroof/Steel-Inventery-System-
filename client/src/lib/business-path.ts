export function slugifyBusinessName(name: string): string {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "business";
  const reserved = new Set(["admin", "login", "api", "audit", "profit", "invoices", "images"]);
  return reserved.has(base) ? `${base}-shop` : base;
}

/** Build a tenant path: /itefaq-steel-mill/dashboard */
export function businessPath(slug: string, page = "dashboard"): string {
  const clean = page.replace(/^\/+/, "");
  return `/${slug}/${clean}`;
}

const GLOBAL_PREFIXES = new Set(["admin", "login", "api", "images", "audit", "profit", "invoices"]);

export function businessSlugFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (GLOBAL_PREFIXES.has(parts[0])) return null;
  return parts[0];
}

export function pagePathFromBusinessRoute(pathname: string): string | null {
  const slug = businessSlugFromPath(pathname);
  if (!slug) return null;
  const rest = pathname.slice(slug.length + 1) || "/dashboard";
  return rest.startsWith("/") ? rest : `/${rest}`;
}

export function legacyBusinessPath(pathname: string): string | null {
  if (!pathname || pathname === "/") return null;
  if (businessSlugFromPath(pathname)) return null;
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0 || GLOBAL_PREFIXES.has(parts[0])) return null;
  return pathname;
}
