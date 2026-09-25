import "server-only";

const DEV_FALLBACK = "http://127.0.0.1:4000";

/** Nest API origin (no trailing slash). Required when NODE_ENV is production. */
export function getTijarattApiBase(): string {
  const configured = process.env.TIJARATT_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "TIJARATT_API_URL must be set in production (server-only env on the Next.js host).",
    );
  }

  return DEV_FALLBACK;
}
