import { ApiError } from "./api";

/** Nest / BFF error bodies often use `message: string | string[]`. */
export function messageFromApiBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object" || !("message" in body)) return fallback;
  const msg = (body as { message?: unknown }).message;
  if (Array.isArray(msg)) {
    const parts = msg.map((m) => String(m).trim()).filter(Boolean);
    if (parts.length) return parts.join("; ");
  }
  if (typeof msg === "string" && msg.trim()) return msg.trim();
  return fallback;
}

/** Turn a thrown value into text safe to show in the UI. */
export function userFacingError(reason: unknown, fallback = "Something went wrong. Try again."): string {
  if (reason instanceof ApiError && reason.message.trim()) return reason.message;
  if (reason instanceof Error && reason.message.trim()) return reason.message;
  if (typeof reason === "string" && reason.trim()) return reason.trim();
  return fallback;
}
