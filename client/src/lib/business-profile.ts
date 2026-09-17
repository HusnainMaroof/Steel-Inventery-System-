"use client";

import { useAuth } from "./auth";
import { useUiPreferences } from "./preferences";

export interface BusinessProfile {
  businessName: string;
  ownerName: string;
  address: string;
  city: string;
  phone: string;
  email?: string;
  tagline?: string;
  logoSrc?: string;
  invoiceNote?: string;
}

const DEFAULT_PROFILE: BusinessProfile = {
  businessName: "Tradex Business",
  ownerName: "",
  address: "",
  city: "",
  phone: "",
};

/** Business details for invoices & letterhead — login + Settings */
export function useBusinessProfile(): BusinessProfile {
  const { user } = useAuth();
  const { prefs } = useUiPreferences();
  const shopName =
    prefs.invoiceName.trim() ||
    user?.businessName ||
    DEFAULT_PROFILE.businessName;
  const email = prefs.invoiceEmail.trim() || user?.email || "";
  const logoSrc =
    user?.role === "SUPERADMIN" ? undefined : prefs.logoDataUrl.trim() || undefined;
  const invoiceNote = prefs.invoiceNote.trim() || undefined;
  if (!user) {
    return {
      ...DEFAULT_PROFILE,
      businessName: shopName,
      address: prefs.address,
      city: prefs.city,
      phone: prefs.phone,
      email,
      logoSrc,
      invoiceNote,
    };
  }
  return {
    businessName: shopName,
    ownerName: user.name,
    address: prefs.address,
    city: prefs.city,
    phone: prefs.phone,
    email,
    logoSrc,
    invoiceNote,
  };
}
