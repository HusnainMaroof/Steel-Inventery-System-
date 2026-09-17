export const OFFLINE_PATH = "/offline";

export function isServerUnavailableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

export function isServerUnavailableMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("cannot reach") ||
    lower.includes("took too long") ||
    lower.includes("timed out") ||
    lower.includes("not running")
  );
}

export function offlineRedirectUrl(nextPath?: string): string {
  const fallback =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/";
  const next = nextPath ?? fallback;
  if (next.startsWith(OFFLINE_PATH)) return OFFLINE_PATH;
  return `${OFFLINE_PATH}?next=${encodeURIComponent(next)}`;
}

export function redirectToOfflinePage(nextPath?: string): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith(OFFLINE_PATH)) return;
  window.location.replace(offlineRedirectUrl(nextPath));
}

export async function probeAppHealth(): Promise<boolean> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  }
}
