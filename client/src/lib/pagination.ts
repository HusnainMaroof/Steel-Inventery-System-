export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export const DEFAULT_PAGE_SIZE = 25;

export function pageRange(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, i) => i + 1);
  }
  const out: (number | "gap")[] = [1];
  if (page > 3) out.push("gap");
  for (let p = Math.max(2, page - 1); p <= Math.min(pages - 1, page + 1); p++) {
    out.push(p);
  }
  if (page < pages - 2) out.push("gap");
  out.push(pages);
  return out;
}
