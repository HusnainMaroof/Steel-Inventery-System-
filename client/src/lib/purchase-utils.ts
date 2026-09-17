import type { Payment, Purchase } from "./types";
import { round2 } from "./money";

/** Server purchase document id — shared by every line of a multi-line purchase. */
export function purchaseParentId(p: Purchase): string {
  return p.purchaseId ?? p.id;
}

/** Mill payable for one line — goods value only (transport etc. are on us). */
export function steelAmount(p: Purchase): number {
  return p.qty * p.rate;
}

export function groupPurchasesByParent(purchases: Purchase[]): Map<string, Purchase[]> {
  const map = new Map<string, Purchase[]>();
  for (const p of purchases) {
    const pid = purchaseParentId(p);
    const list = map.get(pid) ?? [];
    list.push(p);
    map.set(pid, list);
  }
  return map;
}

export function purchaseDocumentTotals(lines: Purchase[]) {
  const goods = round2(lines.reduce((sum, row) => sum + steelAmount(row), 0));
  const paid = lines[0]?.paid ?? 0;
  return { goods, paid, remaining: Math.max(0, round2(goods - paid)) };
}

export function purchaseTotals(p: Purchase, allPurchases: Purchase[]) {
  const pid = purchaseParentId(p);
  const lines = allPurchases.filter((row) => purchaseParentId(row) === pid);
  return purchaseDocumentTotals(lines);
}

/** Parent purchase ids that still owe the mill. */
export function duePurchaseParentIds(purchases: Purchase[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const p of purchases) {
    const pid = purchaseParentId(p);
    if (seen.has(pid)) continue;
    seen.add(pid);
    if (purchaseTotals(p, purchases).remaining > 0.001) ids.push(pid);
  }
  return ids;
}

/** Reconstruct per-purchase payment journals from supplier payments (FIFO, same as server). */
export function hydratePurchasePaymentHistories(
  purchases: Purchase[],
  payments: Payment[],
): Purchase[] {
  const byParent = groupPurchasesByParent(purchases);
  const meta = new Map<
    string,
    {
      supplierId: string;
      date: string;
      goods: number;
      paid: number;
      history: { date: string; amount: number }[];
      allocated: number;
    }
  >();

  for (const [pid, lines] of byParent) {
    const goods = round2(lines.reduce((s, l) => s + steelAmount(l), 0));
    meta.set(pid, {
      supplierId: lines[0]!.supplierId,
      date: lines[0]!.date,
      goods,
      paid: lines[0]?.paid ?? 0,
      history: [],
      allocated: 0,
    });
  }

  const supplierPayments = payments
    .filter((p) => p.type === "supplier")
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  for (const pmt of supplierPayments) {
    const open = [...meta.entries()]
      .filter(([, m]) => m.supplierId === pmt.partyId)
      .sort(
        (a, b) =>
          a[1].date.localeCompare(b[1].date) || a[0].localeCompare(b[0]),
      );

    let left = pmt.amount;
    for (const [pid, m] of open) {
      if (left <= 0.005) break;
      const due = Math.max(0, m.goods - m.allocated);
      const take = Math.min(due, left);
      if (take > 0.005) {
        m.history.push({ date: pmt.date, amount: round2(take) });
        m.allocated = round2(m.allocated + take);
        left = round2(left - take);
      }
    }
  }

  return purchases.map((p) => {
    const m = meta.get(purchaseParentId(p));
    if (!m) return p;
    const last = m.history[m.history.length - 1];
    return {
      ...p,
      paid: m.paid,
      paymentHistory: m.history.length ? m.history : p.paymentHistory,
      lastPaidAt: last?.date ?? p.lastPaidAt,
      lastPaidAmount: last?.amount ?? p.lastPaidAmount,
    };
  });
}
