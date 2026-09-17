import { BadRequestException } from "@nestjs/common";
import { LIMITS } from "./limits";
import { sanitizeOptionalText, sanitizeText } from "./sanitize-text";

const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/;

export type SanitizedUiSettings = {
  showOptionalDetails: boolean;
  address: string;
  city: string;
  phone: string;
  invoiceEmail: string;
  invoiceName: string;
  invoiceNote: string;
  logoDataUrl: string;
};

export function sanitizeUiSettings(raw: Record<string, unknown>): SanitizedUiSettings {
  const logo =
    typeof raw.logoDataUrl === "string" ? raw.logoDataUrl.trim() : "";
  if (logo) {
    if (logo.length > LIMITS.MAX_LOGO_DATA_URL_CHARS) {
      throw new BadRequestException("Logo image is too large");
    }
    if (!LOGO_RE.test(logo)) {
      throw new BadRequestException(
        "Logo must be a PNG, JPEG, or WebP image encoded as a data URL",
      );
    }
  }

  const email =
    typeof raw.invoiceEmail === "string"
      ? sanitizeText(raw.invoiceEmail, 120)
      : "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException("Invoice email is not valid");
  }

  return {
    showOptionalDetails: raw.showOptionalDetails === true,
    address: sanitizeText(typeof raw.address === "string" ? raw.address : "", 200),
    city: sanitizeText(typeof raw.city === "string" ? raw.city : "", 80),
    phone: sanitizeText(typeof raw.phone === "string" ? raw.phone : "", 40),
    invoiceEmail: email,
    invoiceName: sanitizeText(
      typeof raw.invoiceName === "string" ? raw.invoiceName : "",
      120,
    ),
    invoiceNote: sanitizeOptionalText(
      typeof raw.invoiceNote === "string" ? raw.invoiceNote : "",
      500,
    ) ?? "",
    logoDataUrl: logo,
  };
}
