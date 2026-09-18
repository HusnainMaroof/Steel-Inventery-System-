import { LIMITS } from "../security/limits";

const MAX_PAGES = 200;

/** Fetch every page from a paginated list function (max 200 × page size rows). */
export async function paginateAll<T>(
  fetchPage: (skip: number, take: number) => Promise<readonly [T[], number]>,
  pageSize = LIMITS.MAX_PAGE_SIZE,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let pages = 1;
  do {
    const [batch, total] = await fetchPage((page - 1) * pageSize, pageSize);
    items.push(...batch);
    pages = Math.max(1, Math.ceil(total / pageSize));
    page += 1;
    if (page > MAX_PAGES) break;
  } while (page <= pages);
  return items;
}
