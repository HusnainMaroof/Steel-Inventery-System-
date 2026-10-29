import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const disallow = ["/admin", "/api/"];

/** AI search crawlers, named so their access is explicit. Each named group replaces the `*` group for that bot. */
const AI_SEARCH_BOTS = ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      { userAgent: AI_SEARCH_BOTS, allow: "/", disallow },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
