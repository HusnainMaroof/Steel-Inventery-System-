"use client";

import { useCallback } from "react";
import { useStore } from "./store";
import type { UiPreferences } from "./ui-preferences";

/**
 * UI preferences come from the store bootstrap (PostgreSQL via /settings).
 * Updates go straight to the API — no localStorage.
 */
export function useUiPreferences() {
  const { uiPrefs, updateUiPrefs, ready } = useStore();

  const patchPrefs = useCallback(
    (patch: Partial<UiPreferences>) => updateUiPrefs(patch),
    [updateUiPrefs],
  );

  const setPref = useCallback(
    <K extends keyof UiPreferences>(key: K, value: UiPreferences[K]) => {
      patchPrefs({ [key]: value } as Partial<UiPreferences>);
    },
    [patchPrefs],
  );

  return { prefs: uiPrefs, setPref, patchPrefs, ready };
}

export type { UiPreferences } from "./ui-preferences";
