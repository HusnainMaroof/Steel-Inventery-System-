/**
 * Sale availability (§9, §22): a sale line can only take stock that the
 * inventory ledger says exists. Overselling is rejected with a per-product
 * shortage list — the caller rolls the whole transaction back.
 */
export interface StockLevel {
  productId: string;
  available: number;
}

export interface RequestedLine {
  productId: string;
  qty: number;
}

export interface Shortage {
  productId: string;
  available: number;
  requested: number;
  missing: number;
}

export function stockLevelsFromLedger(
  tx: { productId: string; qty: number }[],
): Map<string, number> {
  const levels = new Map<string, number>();
  for (const t of tx) {
    levels.set(t.productId, (levels.get(t.productId) ?? 0) + t.qty);
  }
  return levels;
}

/**
 * Returns every product whose requested quantity exceeds availability.
 * An empty result means the sale may proceed.
 */
export function findShortages(
  levels: Map<string, number>,
  requested: RequestedLine[],
): Shortage[] {
  const shortages: Shortage[] = [];
  for (const line of requested) {
    const available = levels.get(line.productId) ?? 0;
    const missing = round3(line.qty - available);
    if (missing > 0.0005) {
      shortages.push({
        productId: line.productId,
        available,
        requested: line.qty,
        missing,
      });
    }
  }
  return shortages;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
