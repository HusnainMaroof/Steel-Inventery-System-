import "server-only";
import { getSessionToken } from "./session";
import type { TradexRole, TradexUser } from "../auth-types";
import { sanitizeAccess, type StaffPage } from "../staff-access";

export type { TradexRole, TradexUser, StaffPage };

type NestErrorBody = {
  message?: string | string[];
  error?: string;
};

function apiBase(): string {
  return (process.env.TRADEX_API_URL ?? "http://127.0.0.1:4000").replace(
    /\/$/,
    "",
  );
}

function readMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const msg = (body as NestErrorBody).message;
  if (Array.isArray(msg)) return msg.join("; ");
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
}

export async function tradexFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T; status: number } | { ok: false; message: string; status: number }> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Authorization")) {
    const token = await getSessionToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      status: 503,
      message: "Cannot reach the Tradex server. Is it running?",
    };
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { message: text };
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: readMessage(json, res.statusText || "Request failed"),
    };
  }

  return { ok: true, data: json as T, status: res.status };
}

export function toPublicUser(raw: {
  id: string;
  email: string;
  name: string;
  role: TradexRole;
  businessId: string;
  businessName?: string;
  businessSlug?: string;
  title?: string | null;
  access?: string[];
  business?: { name: string; slug?: string } | null;
}): TradexUser {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    role: raw.role,
    title: raw.title ?? null,
    access: sanitizeAccess(raw.access),
    businessId: raw.businessId,
    businessName: raw.businessName ?? raw.business?.name ?? "",
    businessSlug: raw.businessSlug ?? raw.business?.slug ?? "",
  };
}
