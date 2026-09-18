import { Prisma } from "@prisma/client";

/** Sold qty keyed by `purchaseId:productId:variantId` (empty string when variant is null). */
export async function consumedQtyByLot(
  tx: Prisma.TransactionClient,
  businessId: string,
  purchaseIds: string[],
): Promise<Map<string, number>> {
  if (purchaseIds.length === 0) return new Map();
  const rows = await tx.$queryRaw<
    { purchaseId: string; productId: string; variantId: string | null; qty: string }[]
  >`
    SELECT sl."purchaseId", sl."productId", sl."variantId",
           COALESCE(SUM(sl.qty), 0)::text AS qty
    FROM "SaleLine" sl
    INNER JOIN "Sale" s ON s.id = sl."saleId"
    WHERE s."businessId" = ${businessId}
      AND sl."purchaseId" IN (${Prisma.join(purchaseIds)})
    GROUP BY sl."purchaseId", sl."productId", sl."variantId"
  `;
  return new Map(
    rows.map((row) => [
      `${row.purchaseId}:${row.productId}:${row.variantId ?? ""}`,
      Number(row.qty),
    ]),
  );
}

export type OpenPurchaseRow = {
  id: string;
  paid: Prisma.Decimal;
  goods: string;
};

/** Purchases for FIFO supplier settlement — goods total computed in SQL, ordered oldest first. */
export async function openPurchasesForSupplier(
  tx: Prisma.TransactionClient,
  businessId: string,
  supplierId: string,
): Promise<OpenPurchaseRow[]> {
  return tx.$queryRaw<OpenPurchaseRow[]>`
    SELECT p.id,
           p.paid,
           COALESCE((
             SELECT SUM(pl.qty * pl.rate)
             FROM "PurchaseLine" pl
             WHERE pl."purchaseId" = p.id
           ), 0)::text AS goods
    FROM "Purchase" p
    WHERE p."businessId" = ${businessId}
      AND p."supplierId" = ${supplierId}
    ORDER BY p.date ASC, p."createdAt" ASC
  `;
}

export type BusinessActivityCounts = {
  businessId: string;
  sales30d: number;
  purchases30d: number;
  payments30d: number;
};

/** 30-day activity counts per business — one round-trip instead of 3×N owner queries. */
export async function activityCountsByBusiness(
  prisma: Prisma.TransactionClient,
  since: Date,
): Promise<Map<string, BusinessActivityCounts>> {
  const [sales, purchases, payments] = await Promise.all([
    prisma.sale.groupBy({
      by: ["businessId"],
      where: { date: { gte: since } },
      _count: { _all: true },
    }),
    prisma.purchase.groupBy({
      by: ["businessId"],
      where: { date: { gte: since } },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ["businessId"],
      where: { date: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  const map = new Map<string, BusinessActivityCounts>();
  for (const row of sales) {
    const entry = map.get(row.businessId) ?? {
      businessId: row.businessId,
      sales30d: 0,
      purchases30d: 0,
      payments30d: 0,
    };
    entry.sales30d = row._count._all;
    map.set(row.businessId, entry);
  }
  for (const row of purchases) {
    const entry = map.get(row.businessId) ?? {
      businessId: row.businessId,
      sales30d: 0,
      purchases30d: 0,
      payments30d: 0,
    };
    entry.purchases30d = row._count._all;
    map.set(row.businessId, entry);
  }
  for (const row of payments) {
    const entry = map.get(row.businessId) ?? {
      businessId: row.businessId,
      sales30d: 0,
      purchases30d: 0,
      payments30d: 0,
    };
    entry.payments30d = row._count._all;
    map.set(row.businessId, entry);
  }
  return map;
}
