/**
 * Pure money helpers (§11). All arithmetic runs on Prisma.Decimal (decimal.js),
 * never on JavaScript floats.
 *
 * Precision policy:
 * - Money totals (goods, charges, landed total, invoice totals, profit) are
 *   rounded HALF-UP to 2 decimals (PKR paisa). Rounding happens once, at the
 *   end of each documented boundary step, never mid-chain on displayed values.
 * - Unit cost (landed cost per unit) is NOT rounded. It keeps Decimal's full
 *   precision (20 significant digits) so `unitCost × qty` stays exact.
 * - Quantities are Decimal(14, 3) in the database and are used as-is.
 */
import { Prisma } from "@prisma/client";

type DecimalValue = Prisma.Decimal.Value;

const D = (value: DecimalValue) => new Prisma.Decimal(value);

/** Round a value to whole paisa using half-up. Returns a Decimal. */
export function roundMoneyDecimal(value: DecimalValue): Prisma.Decimal {
  return D(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** Round to 2 decimals, half-up, and return a JS number for API/UI boundaries. */
export function round2(value: DecimalValue): number {
  return roundMoneyDecimal(value).toNumber();
}

/** Sum of qty × rate for each line, exact. */
function goodsSumDecimal(lines: { qty: DecimalValue; rate: DecimalValue }[]): Prisma.Decimal {
  return lines.reduce(
    (sum, l) => sum.plus(D(l.qty).times(D(l.rate))),
    D(0),
  );
}

/** Goods total of a purchase (mill payable basis), rounded to paisa. */
export function purchaseGoodsTotal(lines: {
  qty: DecimalValue;
  rate: DecimalValue;
}[]): number {
  return round2(goodsSumDecimal(lines));
}

/** Landed total = goods + loading + transport + labour + other, rounded to paisa. */
export function landedCostTotal(input: {
  goodsTotal: DecimalValue;
  transport: DecimalValue;
  loading: DecimalValue;
  labour: DecimalValue;
  other: DecimalValue;
}): number {
  return round2(
    D(input.goodsTotal)
      .plus(D(input.transport))
      .plus(D(input.loading))
      .plus(D(input.labour))
      .plus(D(input.other)),
  );
}

/**
 * Landed cost per unit, charges spread across units by quantity share.
 * Returns an unrounded Decimal: callers multiply it by quantity and round
 * only the final money amount.
 */
export function landedCostPerUnit(input: {
  qty: DecimalValue;
  rate: DecimalValue;
  purchaseCharges: DecimalValue;
}): Prisma.Decimal {
  const qty = D(input.qty);
  if (qty.lte(0)) return D(0);
  return D(input.qty)
    .times(D(input.rate))
    .plus(D(input.purchaseCharges))
    .div(qty);
}

export interface SaleLineInput {
  qty: DecimalValue;
  rate: DecimalValue;
}

export interface SaleChargesInput {
  discountPct: DecimalValue;
  taxPct: DecimalValue;
  loading: DecimalValue;
  transport: DecimalValue;
  labour: DecimalValue;
}

/** Invoice subtotal (qty × rate summed), rounded to paisa. */
export function saleSubtotal(lines: SaleLineInput[]): number {
  return round2(goodsSumDecimal(lines));
}

export interface SaleTotalsDecimal {
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  taxable: Prisma.Decimal;
  tax: Prisma.Decimal;
  chargesTotal: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
}

/**
 * Invoice math: subtotal − discount% + tax% + flat charges (charges not taxed).
 * Every step rounds to paisa (half-up) and stays a Decimal. Use this for
 * persistence. `saleGrandTotal` is the number view for API and UI boundaries.
 */
export function saleGrandTotalDecimal(
  lines: SaleLineInput[],
  charges: SaleChargesInput,
): SaleTotalsDecimal {
  const subtotal = roundMoneyDecimal(goodsSumDecimal(lines));
  const discount = roundMoneyDecimal(subtotal.times(D(charges.discountPct)).div(100));
  const taxable = subtotal.minus(discount);
  const tax = roundMoneyDecimal(taxable.times(D(charges.taxPct)).div(100));
  const chargesTotal = roundMoneyDecimal(
    D(charges.loading).plus(D(charges.transport)).plus(D(charges.labour)),
  );
  return {
    subtotal,
    discount,
    taxable,
    tax,
    chargesTotal,
    grandTotal: roundMoneyDecimal(taxable.plus(tax).plus(chargesTotal)),
  };
}

/** Number view of `saleGrandTotalDecimal` for profit, reports and UI. */
export function saleGrandTotal(
  lines: SaleLineInput[],
  charges: SaleChargesInput,
): {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  chargesTotal: number;
  grandTotal: number;
} {
  const t = saleGrandTotalDecimal(lines, charges);
  return {
    subtotal: t.subtotal.toNumber(),
    discount: t.discount.toNumber(),
    taxable: t.taxable.toNumber(),
    tax: t.tax.toNumber(),
    chargesTotal: t.chargesTotal.toNumber(),
    grandTotal: t.grandTotal.toNumber(),
  };
}

/** Profit on sales = (sale rate − cost rate) × sold qty. Never profit on stock still held. */
export function profitOnSales(input: {
  salesRevenue: DecimalValue;
  stockCost: DecimalValue;
}): number {
  return round2(D(input.salesRevenue).minus(D(input.stockCost)));
}
