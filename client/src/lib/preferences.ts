"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "tradex-ui-prefs";
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

function load(): UiPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<UiPreferences>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function save(next: UiPreferences) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(PREFS_EVENT));
}

export function useUiPreferences() {
  const [prefs, setPrefs] = useState<UiPreferences>(load);

  useEffect(() => {
    const refresh = () => setPrefs(load());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(PREFS_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PREFS_EVENT, refresh);
    };
  }, []);

  const patchPrefs = useCallback((patch: Partial<UiPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  const setPref = useCallback(<K extends keyof UiPreferences>(key: K, value: UiPreferences[K]) => {
    patchPrefs({ [key]: value } as Partial<UiPreferences>);
  }, [patchPrefs]);

  return { prefs, setPref, patchPrefs };
}
