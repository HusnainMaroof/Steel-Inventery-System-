import { apiFetch } from "./api";

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

const MAX_PAGES = 200;

export async function fetchAllPages<T>(path: string, limit = 100): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let pages = 1;
  do {
    const res = await apiFetch<Paginated<T>>(`${path}?page=${page}&limit=${limit}`);
    items.push(...res.items);
    pages = res.pages;
    page += 1;
    if (page > MAX_PAGES) break;
  } while (page <= pages);
  return items;
}
