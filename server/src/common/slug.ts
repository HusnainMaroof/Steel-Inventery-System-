const RESERVED = new Set([
  "admin",
  "login",
  "api",
  "audit",
  "profit",
  "invoices",
  "images",
  "favicon.ico",
]);

export function slugifyName(name: string): string {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "business";
  return RESERVED.has(base) ? `${base}-shop` : base;
}

export async function uniqueBusinessSlug(
  prisma: { business: { findUnique: (args: { where: { slug: string } }) => Promise<{ id: string } | null> } },
  name: string,
): Promise<string> {
  const base = slugifyName(name);
  let slug = base;
  let n = 2;
  while (await prisma.business.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`;
  }
  return slug;
}
