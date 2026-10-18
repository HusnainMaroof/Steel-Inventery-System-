/**
 * Sale availability (§9, §22): a sale line can only take stock that the
 * inventory ledger says exists. Overselling is rejected with a per-product
 * shortage list — the caller rolls the whole transaction back.
 *
 * Quantities are Decimal end to end. Stored quantities have 3 decimals, so
 * comparisons are exact and need no tolerance.
 */
import { Prisma } from "@prisma/client";

type D = Prisma.Decimal.Value;
const Dec = (v: D) => new Prisma.Decimal(v);

export interface StockLevel {
  productId: string;
  available: Prisma.Decimal;
}

export interface RequestedLine {
  productId: string;
  qty: D;
}

export interface Shortage {
  productId: string;
  available: Prisma.Decimal;
  requested: Prisma.Decimal;
  missing: Prisma.Decimal;
}

export function stockLevelsFromLedger(
  tx: { productId: string; qty: D }[],
): Map<string, Prisma.Decimal> {
  const levels = new Map<string, Prisma.Decimal>();
  for (const t of tx) {
    levels.set(t.productId, (levels.get(t.productId) ?? Dec(0)).plus(Dec(t.qty)));
  }
  return levels;
}

/**
 * Returns every product whose requested quantity exceeds availability.
 * An empty result means the sale may proceed.
 */
export function findShortages(
  levels: Map<string, Prisma.Decimal>,
  requested: RequestedLine[],
): Shortage[] {
  const shortages: Shortage[] = [];
  for (const line of requested) {
    const available = levels.get(line.productId) ?? Dec(0);
    const qty = Dec(line.qty);
    if (qty.gt(available)) {
      shortages.push({
        productId: line.productId,
        available,
        requested: qty,
        missing: qty.minus(available),
      });
    }
  }
  return shortages;
}
