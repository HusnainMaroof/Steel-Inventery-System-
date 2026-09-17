/** Client money helpers — mirror server/src/domain/money.ts rounding boundaries. */

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function saleSubtotal(lines: { qty: number; rate: number }[]): number {
  return round2(lines.reduce((sum, l) => sum + l.qty * l.rate, 0));
}

export function saleDiscountAmount(
  lines: { qty: number; rate: number }[],
  discountPct = 0,
): number {
  return round2(saleSubtotal(lines) * (discountPct / 100));
}

export function saleTaxableAmount(
  lines: { qty: number; rate: number }[],
  discountPct = 0,
): number {
  return round2(saleSubtotal(lines) - saleDiscountAmount(lines, discountPct));
}

export function saleTaxAmount(
  lines: { qty: number; rate: number }[],
  discountPct = 0,
  taxPct = 0,
): number {
  return round2(saleTaxableAmount(lines, discountPct) * (taxPct / 100));
}

export function saleChargesTotal(charges: {
  loading?: number;
  transport?: number;
  labour?: number;
}): number {
  return round2(
    (charges.loading ?? 0) + (charges.transport ?? 0) + (charges.labour ?? 0),
  );
}

export function saleGrandTotalAmount(input: {
  lines: { qty: number; rate: number }[];
  discountPct?: number;
  taxPct?: number;
  loadingCharges?: number;
  transportCharges?: number;
  labourCharges?: number;
}): number {
  const taxable = saleTaxableAmount(input.lines, input.discountPct ?? 0);
  const tax = saleTaxAmount(
    input.lines,
    input.discountPct ?? 0,
    input.taxPct ?? 0,
  );
  const charges = saleChargesTotal({
    loading: input.loadingCharges,
    transport: input.transportCharges,
    labour: input.labourCharges,
  });
  return round2(taxable + tax + charges);
}
