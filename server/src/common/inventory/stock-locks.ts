import type { Prisma } from "@prisma/client";

/**
 * Serialize inventory mutations per business/product/(variant|lot) within a transaction.
 * Prevents concurrent sales from passing the same stock check (TOCTOU).
 *
 * All keys are taken in one statement (one database round trip instead of one per key).
 * Keys are deduped and sorted, and taken in that order (`ORDER BY ord`; Postgres runs the
 * volatile lock call after the sort), so two transactions never wait on each other in a cycle.
 */
export async function lockInventoryKeys(
  tx: Prisma.TransactionClient,
  keys: string[],
): Promise<void> {
  const sorted = [...new Set(keys)].sort();
  if (sorted.length === 0) return;
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(k))
    FROM unnest(${sorted}::text[]) WITH ORDINALITY AS t(k, ord)
    ORDER BY ord
  `;
}

export function stockLockKey(
  businessId: string,
  productId: string,
  variantId?: string | null,
): string {
  return `stock:${businessId}:${productId}:${variantId ?? "_"}`;
}

/** Serializes invoice-number allocation per business. Taken last in a sale. */
export function invoiceNumberLockKey(businessId: string): string {
  return `invoice-number:${businessId}`;
}

export function lotLockKey(
  businessId: string,
  purchaseId: string,
  productId: string,
  variantId?: string | null,
): string {
  return `lot:${businessId}:${purchaseId}:${productId}:${variantId ?? "_"}`;
}
