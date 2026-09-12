"use client";

import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type Role = "superadmin" | "owner";

export interface BusinessProfile {
  businessName: string;
  ownerName: string;
  address: string;
  city: string;
  phone: string;
  email?: string;
  tagline?: string;
}

export interface OwnerAccount {
  id: string;
  name: string;
  businessName: string; // shown in the logged-in brand spot ("the Tradex place")
  username: string;
  password: string;
  /** Printed on invoices */
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  tagline?: string;
}

export interface AuthUser {
  username: string;
  name: string;
  role: Role;
  businessName?: string;
}

/*
 * Demo logins — edit these consts to set the real accounts.
 * The app is fully client-side with in-memory demo data, so this is a
 * cosmetic gate, not real security. Everything resets on refresh.
 */
export const SUPER_ADMIN = {
  username: "admin",
  password: "admin123",
  name: "Super Admin",
};

export const SEED_OWNERS: OwnerAccount[] = [
  {
    id: "own-shazib",
    name: "M. Shazib",
    businessName: "New Ittifaq Steel Depot",
    address: "Plot 45, Steel Market, Badami Bagh",
    city: "Lahore, Pakistan",
    phone: "042-3723-4567",
    email: "sales@ittifaqsteel.pk",
    tagline: "Steel · Rebar · Wire · Cement",
    username: "shazib",
    password: "demo123",
  },
];

const DEFAULT_PROFILE: BusinessProfile = {
  businessName: "Tradex Business",
  ownerName: "",
  address: "",
  city: "Pakistan",
  phone: "",
};

/* each role lands on its own home after signing in */
export const homeFor = (u: AuthUser) =>
  u.role === "superadmin" ? "/admin" : "/dashboard";

let seq = 1000;
const nextId = () => `own-x${seq++}`;

interface Auth {
  user: AuthUser | null;
  owners: OwnerAccount[];
  login: (username: string, password: string) => boolean;
  logout: () => void;
  // returns an error message, or null on success
  addOwner: (o: Omit<OwnerAccount, "id">) => string | null;
  deleteOwner: (id: string) => void;
}

const AuthCtx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [owners, setOwners] = useState<OwnerAccount[]>(SEED_OWNERS);

  const login = (username: string, password: string) => {
    const u = username.trim().toLowerCase();
    if (
      u === SUPER_ADMIN.username.toLowerCase() &&
      password === SUPER_ADMIN.password
    ) {
      setUser({ username: SUPER_ADMIN.username, name: SUPER_ADMIN.name, role: "superadmin" });
      return true;
    }
    const owner = owners.find(
      (o) => o.username.toLowerCase() === u && o.password === password
    );
    if (owner) {
      setUser({
        username: owner.username,
        name: owner.name,
        role: "owner",
        businessName: owner.businessName,
      });
      return true;
    }
    return false;
  };

  const logout = () => setUser(null);

  const addOwner = (o: Omit<OwnerAccount, "id">) => {
    const username = o.username.trim();
    if (!username) return "Username is required.";
    if (!o.name.trim()) return "Owner name is required.";
    if (!o.businessName.trim()) return "Business name is required.";
    if (!o.password) return "Password is required.";
    if (
      username.toLowerCase() === SUPER_ADMIN.username.toLowerCase() ||
      owners.some((x) => x.username.toLowerCase() === username.toLowerCase())
    )
      return "That username is already taken.";
    setOwners((prev) => [...prev, { ...o, username, id: nextId() }]);
    return null;
  };

  const deleteOwner = (id: string) =>
    setOwners((prev) => prev.filter((o) => o.id !== id));

  return (
    <AuthCtx.Provider
      value={{ user, owners, login, logout, addOwner, deleteOwner }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Business details for invoices & letterhead — from the signed-in owner account */
export function useBusinessProfile(): BusinessProfile {
  const { user, owners } = useAuth();
  const owner =
    user?.role === "owner"
      ? owners.find((o) => o.username === user.username)
      : owners[0];
  if (!owner) return DEFAULT_PROFILE;
  return {
    businessName: owner.businessName,
    ownerName: owner.name,
    address: owner.address ?? "",
    city: owner.city ?? "Pakistan",
    phone: owner.phone ?? "",
    email: owner.email,
    tagline: owner.tagline,
  };
}

export function ownerToProfile(owner: OwnerAccount): BusinessProfile {
  return {
    businessName: owner.businessName,
    ownerName: owner.name,
    address: owner.address ?? "",
    city: owner.city ?? "Pakistan",
    phone: owner.phone ?? "",
    email: owner.email,
    tagline: owner.tagline,
  };
}
