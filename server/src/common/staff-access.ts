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
