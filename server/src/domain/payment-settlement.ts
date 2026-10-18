import { Prisma } from "@prisma/client";
import { roundMoneyDecimal } from "./money";

/** Money tolerance: amounts within half a paisa are treated as zero. */
const TOLERANCE = new Prisma.Decimal("0.005");
const Decimal = Prisma.Decimal;
const dec = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

/**
 * Payment settlement (§10, §27): payments never overwrite balances — every
 * payment is a record, and customer payments without a target invoice settle
 * the oldest unpaid invoices first (FIFO), same rule as the client app.
 */
export interface OpenInvoice {
  saleId: string;
  total: Prisma.Decimal.Value;
  paidSoFar: Prisma.Decimal.Value;
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
  amount: Prisma.Decimal.Value,
): SettlementResult {
  const ordered = [...openInvoices]
    .filter((i) => dec(i.total).minus(dec(i.paidSoFar)).gt(TOLERANCE))
    .sort((a, b) => a.date.localeCompare(b.date) || a.saleId.localeCompare(b.saleId));

  let left = dec(amount);
  const allocations: Allocation[] = [];

  for (const invoice of ordered) {
    if (left.lte(TOLERANCE)) break;
    const due = roundMoneyDecimal(dec(invoice.total).minus(dec(invoice.paidSoFar)));
    const take = Decimal.min(due, left);
    if (take.gt(TOLERANCE)) {
      allocations.push({
        saleId: invoice.saleId,
        amount: roundMoneyDecimal(take).toNumber(),
      });
      left = left.minus(take);
    }
  }

  return {
    allocations,
    unallocated: roundMoneyDecimal(Decimal.max(left, 0)).toNumber(),
  };
}

export interface OpenPurchase {
  purchaseId: string;
  goodsTotal: Prisma.Decimal.Value;
  paid: Prisma.Decimal.Value;
}

export interface PurchaseAllocation {
  purchaseId: string;
  amount: number;
}

export interface SupplierSettlementResult {
  allocations: PurchaseAllocation[];
  unallocated: number;
}

/** Settle a supplier payment against open purchase dues in the given FIFO order. */
export function settleSupplierFifo(
  openPurchases: OpenPurchase[],
  amount: Prisma.Decimal.Value,
): SupplierSettlementResult {
  let left = dec(amount);
  const allocations: PurchaseAllocation[] = [];

  for (const purchase of openPurchases) {
    if (left.lte(TOLERANCE)) break;
    const due = roundMoneyDecimal(
      Decimal.max(dec(purchase.goodsTotal).minus(dec(purchase.paid)), 0),
    );
    const take = Decimal.min(due, left);
    if (take.gt(TOLERANCE)) {
      allocations.push({
        purchaseId: purchase.purchaseId,
        amount: roundMoneyDecimal(take).toNumber(),
      });
      left = left.minus(take);
    }
  }

  return {
    allocations,
    unallocated: roundMoneyDecimal(Decimal.max(left, 0)).toNumber(),
  };
}

/** Supplier payable = per purchase (goods total − paid). Charges are on us. */
export function supplierPayable(
  purchases: { goodsTotal: Prisma.Decimal.Value; paid: Prisma.Decimal.Value }[],
): number {
  const total = purchases.reduce((sum, p) => {
    const due = dec(p.goodsTotal).minus(dec(p.paid));
    return sum.plus(Prisma.Decimal.max(due, 0));
  }, new Prisma.Decimal(0));
  return roundMoneyDecimal(total).toNumber();
}
