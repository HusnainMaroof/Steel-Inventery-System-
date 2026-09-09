"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "tradex-ui-prefs";

export type UiPreferences = {
  /** Show lot / heat / warehouse / source-lot fields in purchase & sale forms */
  showOptionalDetails: boolean;
};

const DEFAULTS: UiPreferences = {
  showOptionalDetails: false,
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
}

export function useUiPreferences() {
  const [prefs, setPrefs] = useState<UiPreferences>(load);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPrefs(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPref = useCallback(<K extends keyof UiPreferences>(key: K, value: UiPreferences[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      save(next);
      return next;
    });
  }, []);

  return { prefs, setPref };
}
