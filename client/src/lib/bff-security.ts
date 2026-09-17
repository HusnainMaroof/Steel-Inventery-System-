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
 * CSRF defense for cookie-authenticated BFF mutations.
 * SameSite=strict on the session cookie is the primary guard; this blocks
 * cross-origin fetches that somehow include the cookie.
 */
export function assertSameOrigin(request: Request): string | null {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  const allowed = (process.env.CLIENT_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");

  if (origin) {
    const normalized = origin.replace(/\/$/, "");
    if (normalized !== allowed) {
      const localHttp = host ? `http://${host}` : null;
      const localHttps = host ? `https://${host}` : null;
      if (normalized !== localHttp && normalized !== localHttps) {
        return "Cross-origin request blocked";
      }
    }
    return null;
  }

  const referer = request.headers.get("referer");
  if (referer && host && !referer.includes(host)) {
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
