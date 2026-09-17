/** Strip control chars and trim — reduces XSS / log-injection surface in stored text. */
export function sanitizeText(
  value: string,
  maxLen = 500,
): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLen);
}

export function sanitizeOptionalText(
  value: string | undefined | null,
  maxLen = 500,
): string | undefined {
  if (value == null || value === "") return undefined;
  const clean = sanitizeText(value, maxLen);
  return clean || undefined;
}

/** Attribute snapshots are JSON maps — bound size and strip dangerous values. */
export function sanitizeAttributeSnapshot(
  raw: Record<string, string> | undefined,
  maxKeys = 20,
  maxValueLen = 120,
): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (Object.keys(out).length >= maxKeys) break;
    const k = sanitizeText(key, 64);
    if (!k) continue;
    const v = sanitizeText(String(val ?? ""), maxValueLen);
    if (!v) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}
