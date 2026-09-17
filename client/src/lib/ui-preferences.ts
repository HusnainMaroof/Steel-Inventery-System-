/** Invoice / UI preferences — persisted in PostgreSQL (Business.settings), never localStorage. */

export type UiPreferences = {
  showOptionalDetails: boolean;
  address: string;
  city: string;
  phone: string;
  invoiceEmail: string;
  invoiceName: string;
  invoiceNote: string;
  logoDataUrl: string;
};

export const UI_PREFERENCES_DEFAULTS: UiPreferences = {
  showOptionalDetails: false,
  address: "",
  city: "",
  phone: "",
  invoiceEmail: "",
  invoiceName: "",
  invoiceNote: "",
  logoDataUrl: "",
};

export function mergeUiPreferences(raw?: Partial<UiPreferences> | null): UiPreferences {
  if (!raw || typeof raw !== "object") return { ...UI_PREFERENCES_DEFAULTS };
  return { ...UI_PREFERENCES_DEFAULTS, ...raw };
}
