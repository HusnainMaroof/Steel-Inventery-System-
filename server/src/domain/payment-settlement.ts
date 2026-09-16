/**
 * Payment settlement (§10, §27): payments never overwrite balances — every
 * payment is a record, and customer payments without a target invoice settle
 * the oldest unpaid invoices first (FIFO), same rule as the client app.
 */
export interface OpenInvoice {
  saleId: string;
  total: number;
  paidSoFar: number;
  /** ISO date of the sale — smaller settles first. */
  date: string;
}

export interface Allocation {
  saleId: string;
  amount: number;
}

export interface SettlementResult {
  allocations: Allocation[];
  /** Amount that could not settle any invoice (customer advance). */
  unallocated: number;
}

/**
 * Settle `amount` against the given open invoices, oldest first.
 * An invoice never receives more than its remaining due.
 */
export function settleFifo(
  openInvoices: OpenInvoice[],
  amount: number,
): SettlementResult {
  const ordered = [...openInvoices]
    .filter((i) => i.total - i.paidSoFar > 0.005)
    .sort((a, b) => a.date.localeCompare(b.date) || a.saleId.localeCompare(b.saleId));

  let left = amount;
  const allocations: Allocation[] = [];

  for (const invoice of ordered) {
    if (left <= 0.005) break;
    const due = round2(invoice.total - invoice.paidSoFar);
    const take = Math.min(due, left);
    if (take > 0.005) {
      allocations.push({ saleId: invoice.saleId, amount: round2(take) });
      left = round2(left - take);
    }
  }

  return { allocations, unallocated: round2(Math.max(0, left)) };
}

/** Supplier payable = per purchase (goods total − paid). Charges are on us. */
export function supplierPayable(
  purchases: { goodsTotal: number; paid: number }[],
): number {
  return round2(
    purchases.reduce((sum, p) => sum + Math.max(0, p.goodsTotal - p.paid), 0),
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
