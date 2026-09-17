"use server";

import { createSession, deleteSession } from "@/lib/server/session";
import {
  toPublicUser,
  tradexFetch,
  type TradexRole,
  type TradexUser,
} from "@/lib/server/tradex";

export type AuthActionResult =
  | { ok: true; user: TradexUser }
  | { ok: false; error: string };

type TokenResponse = {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: TradexRole;
    businessId: string;
    businessName?: string;
    businessSlug?: string;
    title?: string | null;
    access?: string[];
    planPages?: string[];
  };
};

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sessionFromToken(token: string, fallback: TokenResponse["user"]): Promise<AuthActionResult> {
  await createSession(token);
  const me = await tradexFetch<{
    id: string;
    email: string;
    name: string;
    role: TradexRole;
    businessId: string;
    business?: { name: string; slug?: string } | null;
    title?: string | null;
    access?: string[];
    planPages?: string[];
  }>("/api/v1/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (me.ok) return { ok: true, user: toPublicUser(me.data) };
  return { ok: true, user: toPublicUser(fallback) };
}

export async function loginAction(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  const trimmed = email.trim().toLowerCase();
  if (!validEmail(trimmed)) return { ok: false, error: "Enter a valid email address." };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const result = await tradexFetch<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: trimmed, password }),
  });
  if (!result.ok) return { ok: false, error: result.message };
  return sessionFromToken(result.data.access_token, result.data.user);
}

export async function clearSessionAction(): Promise<void> {
  await deleteSession();
}

export async function logoutAction(): Promise<void> {
  const token = await import("@/lib/server/session").then((m) => m.getSessionToken());
  if (token) {
    await tradexFetch("/api/v1/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  await deleteSession();
}
