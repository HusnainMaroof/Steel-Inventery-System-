import type { Prisma } from "@prisma/client";

/**
 * Serialize inventory mutations per business/product/(variant|lot) within a transaction.
 * Prevents concurrent sales from passing the same stock check (TOCTOU).
 */
export async function lockInventoryKeys(
  tx: Prisma.TransactionClient,
  keys: string[],
): Promise<void> {
  for (const key of [...new Set(keys)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }
}

export function stockLockKey(
  businessId: string,
  productId: string,
  variantId?: string | null,
): string {
  return `stock:${businessId}:${productId}:${variantId ?? "_"}`;
}

export function lotLockKey(
  businessId: string,
  purchaseId: string,
  productId: string,
  variantId?: string | null,
): string {
  return `lot:${businessId}:${purchaseId}:${productId}:${variantId ?? "_"}`;
}
