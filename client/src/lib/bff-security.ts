import { getClientOrigin } from "@/lib/server/client-origin";

const BLOCKED_SEGMENTS = new Set(["..", ".", ""]);

/** Reject path traversal and empty segments in BFF proxy paths. */
export function assertSafeProxyPath(segments: string[]): string | null {
  for (const segment of segments) {
    if (BLOCKED_SEGMENTS.has(segment) || segment.includes("\\") || segment.includes("\0")) {
      return "Invalid API path";
    }
  }
  return null;
}

/**
 * The configured origin plus its "www." twin (or the bare domain when the
 * configured one has "www."). Both serve this app, so both are same-site.
 */
export function allowedOrigins(clientOrigin: string): Set<string> {
  const url = new URL(clientOrigin);
  const origins = new Set([url.origin]);
  if (url.hostname === "localhost" || /^[\d.]+$/.test(url.hostname)) return origins;
  const twin = new URL(url.origin);
  twin.hostname = url.hostname.startsWith("www.")
    ? url.hostname.slice(4)
    : `www.${url.hostname}`;
  origins.add(twin.origin);
  return origins;
}

/**
 * CSRF defense for cookie-authenticated BFF mutations.
 * SameSite=strict on the session cookie is the primary guard; this blocks
 * cross-origin fetches that somehow include the cookie.
 */
export function assertSameOrigin(request: Request): string | null {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  const allowed = allowedOrigins(getClientOrigin());
  const origin = request.headers.get("origin");

  if (origin) {
    try {
      if (!allowed.has(new URL(origin).origin)) {
        return "Cross-origin request blocked";
      }
    } catch {
      return "Cross-origin request blocked";
    }
    return null;
  }

  const referer = request.headers.get("referer");
  if (!referer) return "Cross-origin request blocked";

  try {
    if (!allowed.has(new URL(referer).origin)) {
      return "Cross-origin request blocked";
    }
  } catch {
    return "Cross-origin request blocked";
  }

  return null;
}

export const PRIVATE_API_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export const APP_SECURITY_HEADERS: Record<string, string> = {
  ...PRIVATE_API_HEADERS,
  "X-DNS-Prefetch-Control": "off",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
