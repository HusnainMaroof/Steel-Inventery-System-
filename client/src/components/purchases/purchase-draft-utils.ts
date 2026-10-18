import Decimal from "decimal.js";
import { round2, roundMoney, sumDecimal, toDecimal } from "../../lib/decimal.ts";
import { fmtMoney } from "../../lib/format.ts";

export type PurchaseDraftLine = {
  key: string;
  productId: string;
  productName: string;
  categoryId?: string;
  variantId: string;
  item: string;
  attributeSnapshot: Record<string, string>;
  qty: number;
  unit: string;
  rate: number;
  sellRate?: number;
  loading: number;
  transport: number;
  labour: number;
  otherCost: number;
  paidToSupplier: number;
  lotNumber?: string;
  heatNumber?: string;
  batchNumber?: string;
  warehouseId?: string;
  locationId?: string;
};

/** Line goods value, rounded half-up to paisa (same as the server line total). */
export function lineGoods(qty: number, rate: number): number {
  return round2(toDecimal(qty).times(toDecimal(rate)));
}

export function lineCharges(
  line: Pick<PurchaseDraftLine, "loading" | "transport" | "labour" | "otherCost">,
): number {
  return round2(
    sumDecimal([line.loading, line.transport, line.labour, line.otherCost]),
  );
}

export function linePaidError(line: PurchaseDraftLine): string | undefined {
  const goods = lineGoods(line.qty, line.rate);
  if (line.paidToSupplier > goods + 0.001) {
    return `Paid to supplier cannot exceed goods (${fmtMoney(goods)} max for this line).`;
  }
  return undefined;
}

export function draftLineTotals(lines: PurchaseDraftLine[]) {
  const goodsExact = sumDecimal(lines.map((l) => toDecimal(l.qty).times(toDecimal(l.rate))));
  const chargesExact = sumDecimal(lines.map((l) => toDecimal(lineCharges(l))));
  const paidExact = sumDecimal(lines.map((l) => l.paidToSupplier || 0));
  const millGoodsTotal = round2(goodsExact);
  const totalCharges = round2(chargesExact);
  const totalPaidToSupplier = round2(paidExact);
  const dueToSupplier = round2(Decimal.max(0, goodsExact.minus(paidExact)));
  const landedTotal = round2(goodsExact.plus(chargesExact));
  return { millGoodsTotal, totalCharges, totalPaidToSupplier, dueToSupplier, landedTotal };
}

export interface PurchaseLiveInput {
  qty: number;
  rate: number;
  sellRate: number;
  loading: number;
  transport: number;
  labour: number;
  otherCost: number;
  paidToSupplier: number;
}

/**
 * Live purchase summary. Same rules as the server:
 * goods = qty x rate, charges = loading + transport + labour + other,
 * landed = goods + charges, landed per unit = landed / qty (not rounded),
 * expected profit per unit = sell rate - landed per unit,
 * expected total profit = profit per unit x qty.
 * Money totals round half-up to paisa; per-unit values stay exact.
 */
export function purchaseLiveTotals(input: PurchaseLiveInput) {
  const qty = toDecimal(input.qty);
  const hasQty = input.qty > 0.001;
  const goods = roundMoney(qty.times(toDecimal(input.rate)));
  const charges = roundMoney(
    toDecimal(input.loading)
      .plus(toDecimal(input.transport))
      .plus(toDecimal(input.labour))
      .plus(toDecimal(input.otherCost)),
  );
  const landed = roundMoney(goods.plus(charges));
  const landedPerUnit = hasQty ? landed.div(qty) : new Decimal(0);
  const marginPerUnit =
    input.sellRate > 0 ? toDecimal(input.sellRate).minus(landedPerUnit) : new Decimal(0);
  const expectedTotalProfit = hasQty ? roundMoney(marginPerUnit.times(qty)) : new Decimal(0);
  const due = goods.minus(toDecimal(input.paidToSupplier));

  return {
    goodsTotal: goods.toNumber(),
    chargesTotal: charges.toNumber(),
    landedTotal: landed.toNumber(),
    landedPerUnit: landedPerUnit.toNumber(),
    marginPerUnit: marginPerUnit.toNumber(),
    expectedTotalProfit: expectedTotalProfit.toNumber(),
    dueToSupplier: due.lt(0) ? 0 : due.toNumber(),
  };
}
