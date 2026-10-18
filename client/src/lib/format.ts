import Decimal from "decimal.js";
import { toDecimal, type DecimalInput } from "./decimal.ts";

/** Plain number with thousands separators — e.g. 1,234,567 */
export const fmtNum = (n: number, decimals = 0) => {
  if (!Number.isFinite(n)) return "0";
  if (decimals > 0) {
    return n.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
};

/**
 * Money display: full amount, thousands separators, up to 2 decimals (paisa).
 * Display only. Never feed this string back into a calculation.
 */
export const fmtMoney = (n: number) => {
  if (!Number.isFinite(n)) return "₨ 0";
  const rounded = Math.round(n * 100) / 100;
  const fractionDigits = Number.isInteger(rounded) ? 0 : 2;
  return (
    "₨ " +
    rounded.toLocaleString("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
  );
};

/** Per-unit money (landed cost/kg, profit/kg, rate): always exactly 2 decimals. */
export const fmtUnitMoney = (n: number) => {
  if (!Number.isFinite(n)) return "₨ 0.00";
  return (
    "₨ " +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
};

export const fmtSignedMoney = (n: number) => (n < 0 ? "−" + fmtMoney(Math.abs(n)) : fmtMoney(n));

export const fmtPct = (n: number) => {
  if (!Number.isFinite(n)) return "0%";
  return `${n.toFixed(1)}%`;
};

// plural quantity label — "kg" stays, count nouns pluralize ("bag" → "bags")
export const qtyUnitLabel = (u?: string) =>
  u === "bag" || u === "sack" || u === "box" || u === "roll" || u === "dozen"
    ? `${u}s`
    : u ?? "";

/**
 * Quantity display. Rounds HALF-UP to `maxDecimals` with Decimal (no float math),
 * drops trailing zeros (20.000 → 20, 20.100 → 20.1), and keeps thousands separators.
 * Display only: the stored value and every calculation keep full precision.
 */
export const fmtQtyDecimal = (value: DecimalInput, maxDecimals: number): string => {
  const d = toDecimal(value);
  if (!d.isFinite()) return "0";
  const rounded = d.toDecimalPlaces(maxDecimals, Decimal.ROUND_HALF_UP);
  if (rounded.isZero()) return "0";
  const [intPart, frac] = rounded.abs().toFixed().split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = frac ? `${grouped}.${frac}` : grouped;
  return rounded.isNegative() ? `-${body}` : body;
};

// Default quantity display: one decimal place (20.567 → 20.6, 0.5 → 0.5).
// If one decimal would hide a real value (0.04 → 0.0), widen to 2, then 3 decimals,
// so small quantities stay visible (0.04 stays 0.04). Display only.
export const fmtQtyNumber = (n: number) => {
  const d = toDecimal(n);
  if (!d.isFinite() || d.isZero()) return "0";
  for (const places of [1, 2, 3]) {
    if (!d.toDecimalPlaces(places, Decimal.ROUND_HALF_UP).isZero()) {
      return fmtQtyDecimal(d, places);
    }
  }
  return "0";
};

// Reconciliation values (stock check system/physical/difference): keep 3 decimals,
// so a small real difference (e.g. 0.04) is never shown as 0.
export const fmtQtyExact = (n: number) => fmtQtyDecimal(n, 3);

// quantities are stored and shown directly in the product's own unit (kg, bag, …)
export const fmtQtyWithUnit = (qty: number, unit?: string) => {
  const n = fmtQtyNumber(qty);
  return unit ? `${n} ${qtyUnitLabel(unit)}` : n;
};

// rate is stored per product unit; shown per that unit when known
export const fmtRateWithUnit = (rate: number, unit?: string) => {
  const money = fmtMoney(rate);
  return unit ? `${money} / ${unit}` : money;
};

// "per unit" label — always singular ("/ bag", "/ kg")
export const perUnitLabel = (u?: string) => (u ? ` / ${u}` : "");

export const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
// clock time of a recorded event (e.g. when a sale was made) — "11:30 AM"
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

/** Business date plus clock time when the row was recorded (e.g. purchase saved). */
export const fmtDateWithRecordedTime = (dateIso: string, recordedAtIso?: string) => {
  const datePart = fmtDate(dateIso);
  if (!recordedAtIso) return datePart;
  return `${datePart} · ${fmtTime(recordedAtIso)}`;
};
// for full ISO timestamps — shows date and clock time
export const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
};

export const monthKey = (iso: string) => iso.slice(0, 7);

export const MONTHS = [
  { value: "01", label: "January", short: "Jan" },
  { value: "02", label: "February", short: "Feb" },
  { value: "03", label: "March", short: "Mar" },
  { value: "04", label: "April", short: "Apr" },
  { value: "05", label: "May", short: "May" },
  { value: "06", label: "June", short: "Jun" },
  { value: "07", label: "July", short: "Jul" },
  { value: "08", label: "August", short: "Aug" },
  { value: "09", label: "September", short: "Sep" },
  { value: "10", label: "October", short: "Oct" },
  { value: "11", label: "November", short: "Nov" },
  { value: "12", label: "December", short: "Dec" },
] as const;

export const periodInvoiceNo = (year: string, month?: string | null) => {
  if (!month) return `Y-${year}`;
  const m = MONTHS.find((x) => x.value === month);
  return `${(m?.short ?? month).toUpperCase()}-${year}`;
};

export const monthLabel = (key: string) =>
  new Date(key + "-01T00:00:00").toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
