import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

/**
 * Atomically increase invoice.paid; rejects if payment would exceed total.
 * Returns false when the row was not updated (insufficient headroom or wrong tenant).
 */
export async function incrementInvoicePaid(
  tx: Prisma.TransactionClient,
  businessId: string,
  invoiceId: string,
  amount: number,
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    UPDATE "Invoice"
    SET "paid" = "paid" + ${amount}::decimal
    WHERE "id" = ${invoiceId}
      AND "businessId" = ${businessId}
      AND ("paid" + ${amount}::decimal) <= "total"
    RETURNING "id"
  `;
  return rows.length > 0;
}

export async function incrementInvoicePaidOrThrow(
  tx: Prisma.TransactionClient,
  businessId: string,
  invoiceId: string,
  amount: number,
): Promise<void> {
  const ok = await incrementInvoicePaid(tx, businessId, invoiceId, amount);
  if (!ok) {
    throw new BadRequestException(
      "Payment exceeds the remaining due on this invoice or the invoice was not found",
    );
  }
}

/**
 * Atomically increase purchase.paid; rejects if payment would exceed goods total.
 */
export async function incrementPurchasePaid(
  tx: Prisma.TransactionClient,
  businessId: string,
  purchaseId: string,
  amount: number,
  goodsTotal: number,
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    UPDATE "Purchase"
    SET "paid" = "paid" + ${amount}::decimal
    WHERE "id" = ${purchaseId}
      AND "businessId" = ${businessId}
      AND ("paid" + ${amount}::decimal) <= ${goodsTotal}::decimal
    RETURNING "id"
  `;
  return rows.length > 0;
}
