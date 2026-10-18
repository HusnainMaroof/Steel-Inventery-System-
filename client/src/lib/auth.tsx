"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  loginAction,
  logoutAction,
} from "@/app/actions/auth";
import { homePathFor } from "@/lib/staff-access";
import type { TijarattRole, TijarattUser } from "@/lib/auth-types";

export type Role = TijarattRole;
export type AuthUser = TijarattUser;

export type { BusinessProfile } from "@/lib/business-profile";
export { useBusinessProfile } from "@/lib/business-profile";

export const homeFor = (user?: AuthUser | null) => homePathFor(user);

interface Auth {
  user: AuthUser | null;
  ready: boolean;
  blockedMessage: string | null;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const hydrate = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 403) {
          try {
            const body = (await res.json()) as { message?: string };
            setBlockedMessage(body?.message ?? "Your access to this business is blocked. Contact the platform administrator.");
          } catch {
            setBlockedMessage("Your access to this business is blocked. Contact the platform administrator.");
          }
        } else {
          setBlockedMessage(null);
        }
        if (res.status === 401) {
          const { clearSessionAction } = await import("@/app/actions/auth");
          await clearSessionAction();
        }
        setUser(null);
        return;
      }
      setBlockedMessage(null);
      const body = (await res.json()) as AuthUser;
      setUser(body);
    } catch {
      setBlockedMessage(null);
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void hydrate(), 0);
    return () => window.clearTimeout(task);
  }, [hydrate]);

  const login = async (email: string, password: string) => {
    const result = await loginAction(email, password);
    if (!result.ok) return result.error;
    setUser(result.user);
    return null;
  };

  const logout = async () => {
    await logoutAction();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, ready, blockedMessage, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
