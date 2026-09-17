"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth";

const STORAGE_PREFIX = "tradex-ui-prefs";
const PREFS_EVENT = "tradex-prefs-change";

export type UiPreferences = {
  /** Show lot / heat / warehouse / source-lot fields in purchase & sale forms */
  showOptionalDetails: boolean;
  /** Printed on bills under the shop name */
  address: string;
  city: string;
  phone: string;
  invoiceEmail: string;
  /** Name printed on bills; empty = login business name */
  invoiceName: string;
  /** Line at the bottom of the bill */
  invoiceNote: string;
  /** Owner-uploaded factory logo as a data URL */
  logoDataUrl: string;
};

const DEFAULTS: UiPreferences = {
  showOptionalDetails: false,
  address: "",
  city: "",
  phone: "",
  invoiceEmail: "",
  invoiceName: "",
  invoiceNote: "",
  logoDataUrl: "",
};

function storageKey(businessId?: string | null): string {
  return businessId ? `${STORAGE_PREFIX}:${businessId}` : STORAGE_PREFIX;
}

function load(businessId?: string | null): UiPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(storageKey(businessId));
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<UiPreferences>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function cache(next: UiPreferences, businessId?: string | null) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(businessId), JSON.stringify(next));
  window.dispatchEvent(new Event(PREFS_EVENT));
}

function save(next: UiPreferences, businessId?: string | null) {
  cache(next, businessId);
  void fetch("/api/tradex/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: next }),
  });
}

export function useUiPreferences() {
  const { user } = useAuth();
  const businessId = user?.role === "SUPERADMIN" ? null : user?.businessId ?? null;
  const [prefs, setPrefs] = useState<UiPreferences>(DEFAULTS);

  useEffect(() => {
    if (!user) {
      setPrefs(DEFAULTS);
      return;
    }
    if (user.role === "SUPERADMIN") {
      setPrefs(DEFAULTS);
      return;
    }

    setPrefs(load(businessId));

    const controller = new AbortController();
    void fetch("/api/tradex/settings", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as { data?: Partial<UiPreferences> };
        const next = { ...DEFAULTS, ...(body.data ?? {}) };
        cache(next, businessId);
        setPrefs(next);
      })
      .catch(() => undefined);

    const refresh = () => setPrefs(load(businessId));
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey(businessId)) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(PREFS_EVENT, refresh);
    return () => {
      controller.abort();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PREFS_EVENT, refresh);
    };
  }, [user, businessId]);

  const patchPrefs = useCallback(
    (patch: Partial<UiPreferences>) => {
      if (!businessId || user?.role === "SUPERADMIN") return;
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        save(next, businessId);
        return next;
      });
    },
    [businessId, user?.role],
  );

  const setPref = useCallback(
    <K extends keyof UiPreferences>(key: K, value: UiPreferences[K]) => {
      patchPrefs({ [key]: value } as Partial<UiPreferences>);
    },
    [patchPrefs],
  );

  return { prefs, setPref, patchPrefs };
}
