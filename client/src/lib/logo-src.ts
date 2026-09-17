import type { UiPreferences } from "./ui-preferences";

export function logoSrcFromPrefs(prefs: Pick<UiPreferences, "logoUrl" | "logoDataUrl">): string {
  return prefs.logoUrl.trim() || prefs.logoDataUrl.trim();
}
