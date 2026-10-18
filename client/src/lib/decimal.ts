import Decimal from "decimal.js";

/**
 * Client money precision policy (mirrors server/src/domain/money.ts):
 * - Calculations run on decimal.js (exact), never on JS floats.
 * - Finalized money amounts round HALF-UP to 2 decimals (paisa).
 * - Quantities keep up to 3 decimals (DB scale is Decimal(14, 3)).
 * - Unit costs are never rounded before they are multiplied by quantity.
 */
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export type DecimalInput = Decimal.Value | null | undefined;

/** Exact Decimal from an API string, number, or empty value (empty = 0). */
export function toDecimal(value: DecimalInput): Decimal {
  if (value == null || value === "") return new Decimal(0);
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(0);
  }
}

/** Parse API decimal strings (or legacy numbers) into a JS number for display only. */
export function parseDecimal(value: number | string | null | undefined): number {
  return toDecimal(value).toNumber();
}

/** Round to 2 decimals, half-up (money boundary). */
export function roundMoney(value: DecimalInput): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Round to 2 decimals, half-up, returned as a number (API/UI boundary only). */
export function round2(value: DecimalInput): number {
  return roundMoney(value).toNumber();
}

/** Exact sum of money or quantity values. No rounding; round at the boundary. */
export function sumDecimal(values: DecimalInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(toDecimal(v)), new Decimal(0));
}

/** Round to 3 decimals, half-up, returned as a number (quantity boundary only). */
export function round3(value: DecimalInput): number {
  return toDecimal(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
}
