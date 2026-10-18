/**
 * Client money helpers — mirror server/src/domain/money.ts.
 * All sums and products are exact Decimal; money is rounded half-up to
 * paisa only where the server also rounds.
 */
import { round2, roundMoney, toDecimal, type DecimalInput } from "./decimal.ts";
import Decimal from "decimal.js";

export { round2 };

type Line = { qty: DecimalInput; rate: DecimalInput };

function lineSum(lines: Line[]): Decimal {
  return lines.reduce(
    (sum, l) => sum.plus(toDecimal(l.qty).times(toDecimal(l.rate))),
    new Decimal(0),
  );
}

export function saleSubtotal(lines: Line[]): number {
  return roundMoney(lineSum(lines)).toNumber();
}

export function saleDiscountAmount(lines: Line[], discountPct: DecimalInput = 0): number {
  const subtotal = roundMoney(lineSum(lines));
  return roundMoney(subtotal.times(toDecimal(discountPct)).div(100)).toNumber();
}

export function saleTaxableAmount(lines: Line[], discountPct: DecimalInput = 0): number {
  const subtotal = roundMoney(lineSum(lines));
  const discount = roundMoney(subtotal.times(toDecimal(discountPct)).div(100));
  return roundMoney(subtotal.minus(discount)).toNumber();
}

export function saleTaxAmount(
  lines: Line[],
  discountPct: DecimalInput = 0,
  taxPct: DecimalInput = 0,
): number {
  const taxable = toDecimal(saleTaxableAmount(lines, discountPct));
  return roundMoney(taxable.times(toDecimal(taxPct)).div(100)).toNumber();
}

export function saleChargesTotal(charges: {
  loading?: DecimalInput;
  transport?: DecimalInput;
  labour?: DecimalInput;
}): number {
  return roundMoney(
    toDecimal(charges.loading)
      .plus(toDecimal(charges.transport))
      .plus(toDecimal(charges.labour)),
  ).toNumber();
}

export function saleGrandTotalAmount(input: {
  lines: Line[];
  discountPct?: DecimalInput;
  taxPct?: DecimalInput;
  loadingCharges?: DecimalInput;
  transportCharges?: DecimalInput;
  labourCharges?: DecimalInput;
}): number {
  const taxable = toDecimal(saleTaxableAmount(input.lines, input.discountPct ?? 0));
  const tax = toDecimal(
    saleTaxAmount(input.lines, input.discountPct ?? 0, input.taxPct ?? 0),
  );
  const charges = toDecimal(
    saleChargesTotal({
      loading: input.loadingCharges,
      transport: input.transportCharges,
      labour: input.labourCharges,
    }),
  );
  return roundMoney(taxable.plus(tax).plus(charges)).toNumber();
}
