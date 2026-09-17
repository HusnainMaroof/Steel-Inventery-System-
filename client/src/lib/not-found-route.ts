export const NOT_FOUND_PATH = "/404";

export function notFoundRedirectUrl(fromPath?: string): string {
  const fallback =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/";
  const from = fromPath ?? fallback;
  if (from.startsWith(NOT_FOUND_PATH)) return NOT_FOUND_PATH;
  return `${NOT_FOUND_PATH}?from=${encodeURIComponent(from)}`;
}

export function redirectToNotFoundPage(fromPath?: string): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith(NOT_FOUND_PATH)) return;
  window.location.replace(notFoundRedirectUrl(fromPath));
}
