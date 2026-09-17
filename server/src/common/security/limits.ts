/** Hard caps — enforced in DTOs and services so bad data never reaches Prisma. */
export const LIMITS = {
  /** Largest single money field (PKR). */
  MAX_MONEY: 999_999_999.99,
  /** Largest quantity per line. */
  MAX_QTY: 9_999_999.999,
  /** Lines per purchase / sale document. */
  MAX_LINES_PER_DOC: 50,
  /** Single payment record. */
  MAX_PAYMENT_AMOUNT: 100_000_000,
  /** Total payments recorded per business per calendar day. */
  MAX_DAILY_PAYMENT_TOTAL: 500_000_000,
  /** Bootstrap / settings JSON payload. */
  MAX_SETTINGS_BYTES: 512_000,
  /** Logo data URL stored in settings. */
  MAX_LOGO_DATA_URL_CHARS: 450_000,
  /** Attribute snapshot keys per line. */
  MAX_ATTRIBUTE_KEYS: 20,
  MAX_ATTRIBUTE_VALUE_LEN: 120,
  /** Default list page size. */
  DEFAULT_PAGE_SIZE: 50,
  /** Maximum records per API page request. */
  MAX_PAGE_SIZE: 100,
} as const;

import { BadRequestException } from "@nestjs/common";

export function assertMoney(
  value: number,
  label: string,
  max = LIMITS.MAX_MONEY,
): void {
  if (!Number.isFinite(value) || value < 0 || value > max + 0.005) {
    throw new BadRequestException(`${label} must be between 0 and ${max}`);
  }
}

export function assertPositiveMoney(
  value: number,
  label: string,
  max = LIMITS.MAX_PAYMENT_AMOUNT,
): void {
  if (!Number.isFinite(value) || value <= 0 || value > max + 0.005) {
    throw new BadRequestException(`${label} must be between 0.01 and ${max}`);
  }
}

export function assertQty(value: number, label = "Quantity"): void {
  if (!Number.isFinite(value) || value <= 0 || value > LIMITS.MAX_QTY + 0.0005) {
    throw new BadRequestException(
      `${label} must be between 0.001 and ${LIMITS.MAX_QTY}`,
    );
  }
}
