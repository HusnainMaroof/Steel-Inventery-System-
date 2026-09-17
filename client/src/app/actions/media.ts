"use server";

import { getSessionToken } from "@/lib/server/session";

function apiBase(): string {
  return (process.env.TRADEX_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
}

export async function uploadBusinessLogoAction(
  formData: FormData,
): Promise<
  | { ok: true; url: string; publicId: string }
  | { ok: false; error: string }
> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: "Not signed in." };

  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api/v1/media/business-logo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Cannot reach the Tradex server. Is it running?" };
  }

  const text = await res.text();
  let json: { message?: string | string[]; url?: string; publicId?: string } | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as { message?: string | string[]; url?: string; publicId?: string };
    } catch {
      json = { message: text };
    }
  }

  if (!res.ok) {
    const message = Array.isArray(json?.message)
      ? json.message.join("; ")
      : json?.message ?? res.statusText ?? "Upload failed";
    return { ok: false, error: message };
  }

  if (!json?.url || !json.publicId) {
    return { ok: false, error: "Upload succeeded but no image URL was returned." };
  }

  return { ok: true, url: json.url, publicId: json.publicId };
}
