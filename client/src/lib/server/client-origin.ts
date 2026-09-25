import "server-only";

const DEV_FALLBACK = "http://localhost:3000";

/** Public browser origin of this Next app (no trailing slash). Required in production. */
export function getClientOrigin(): string {
  const configured = process.env.CLIENT_ORIGIN?.trim();
  if (configured) return configured.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CLIENT_ORIGIN must be set in production (public URL of the Next.js app).",
    );
  }

  return DEV_FALLBACK;
}
