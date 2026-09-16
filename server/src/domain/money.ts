/**
 * Pure money helpers (§11). The application works in rupees with 2-decimal
 * precision; persistence uses Prisma Decimal. These functions round only at
 * the boundaries — never mid-calculation.
 */

/** Landed cost of a purchase = goods total + all charges on us. */
export function purchaseGoodsTotal(lines: {
  qty: number;
  rate: number;
}[]): number {
  return round2(lines.reduce((sum, l) => sum + l.qty * l.rate, 0));
}

export function landedCostTotal(input: {
  goodsTotal: number;
  transport: number;
  loading: number;
  labour: number;
  other: number;
}): number {
  return round2(
    input.goodsTotal + input.transport + input.loading + input.labour + input.other,
  );
}

/** Landed cost per unit, charges spread across units by quantity share. */
export function landedCostPerUnit(input: {
  qty: number;
  rate: number;
  purchaseCharges: number;
}): number {
  if (input.qty <= 0) return 0;
  return round2((input.qty * input.rate + input.purchaseCharges) / input.qty);
}

export interface SaleLineInput {
  qty: number;
  rate: number;
}

export interface SaleChargesInput {
  discountPct: number;
  taxPct: number;
  loading: number;
  transport: number;
  labour: number;
}

export function saleSubtotal(lines: SaleLineInput[]): number {
  return round2(lines.reduce((sum, l) => sum + l.qty * l.rate, 0));
}

/** Invoice math: subtotal − discount% + tax% + flat charges (charges not taxed). */
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
  const subtotal = saleSubtotal(lines);
  const discount = round2(subtotal * (charges.discountPct / 100));
  const taxable = round2(subtotal - discount);
  const tax = round2(taxable * (charges.taxPct / 100));
  const chargesTotal = round2(
    charges.loading + charges.transport + charges.labour,
  );
  return {
    subtotal,
    discount,
    taxable,
    tax,
    chargesTotal,
    grandTotal: round2(taxable + tax + chargesTotal),
  };
}

/** Profit on sales = (sale rate − cost rate) × sold qty. Never profit on stock still held. */
export function profitOnSales(input: {
  salesRevenue: number;
  stockCost: number;
}): number {
  return round2(input.salesRevenue - input.stockCost);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
