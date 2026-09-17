export type DatabaseTarget = {
  host: string;
  database: string;
  pooled: boolean;
};

/**
 * Safe, loggable view of a Postgres URL — host and database only.
 * Never include user, password, or the raw connection string.
 */
export function parseDatabaseTarget(url: string): DatabaseTarget {
  try {
    const parsed = new URL(url);
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "unknown";
    const host = parsed.hostname || "unknown";
    const pooled =
      host.includes("-pooler") || parsed.searchParams.get("pgbouncer") === "true";
    return { host, database, pooled };
  } catch {
    return { host: "unparseable", database: "unknown", pooled: false };
  }
}

/** Strip credentials from log text so a Prisma error cannot leak .env secrets. */
export function redactSecrets(text: string): string {
  return text.replace(
    /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/@\s]+)@/g,
    "$1***:***@",
  );
}
