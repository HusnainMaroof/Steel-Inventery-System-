"use server";

import { createSession, deleteSession } from "@/lib/server/session";
import {
  toPublicUser,
  tijarattFetch,
  type TijarattRole,
  type TijarattUser,
} from "@/lib/server/tijaratt";

export type AuthActionResult =
  | { ok: true; user: TijarattUser }
  | { ok: false; error: string };

type TokenResponse = {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: TijarattRole;
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

/**
 * The login response already carries the full user (same fields as /auth/me:
 * role, access, planPages, business name and slug), so no second call is made.
 */
async function sessionFromToken(token: string, user: TokenResponse["user"]): Promise<AuthActionResult> {
  await createSession(token);
  return { ok: true, user: toPublicUser(user) };
}

export async function loginAction(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  const trimmed = email.trim().toLowerCase();
  if (!validEmail(trimmed)) return { ok: false, error: "Enter a valid email address." };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const result = await tijarattFetch<TokenResponse>("/api/v1/auth/login", {
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
    await tijarattFetch("/api/v1/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  await deleteSession();
}
