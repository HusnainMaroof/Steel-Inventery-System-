import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Public pages with the date their content last changed. Update the date when you edit a page. */
const pages: { path: string; updated: string; priority: number }[] = [
  { path: "", updated: "2026-10-29", priority: 1 },
  { path: "/pricing", updated: "2026-10-29", priority: 0.8 },
  { path: "/about", updated: "2026-10-29", priority: 0.6 },
  { path: "/contact", updated: "2026-10-29", priority: 0.6 },
  { path: "/privacy-policy", updated: "2026-10-29", priority: 0.3 },
  { path: "/terms-and-conditions", updated: "2026-10-29", priority: 0.3 },
  { path: "/data-deletion", updated: "2026-10-29", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: page.updated,
    priority: page.priority,
  }));
}
