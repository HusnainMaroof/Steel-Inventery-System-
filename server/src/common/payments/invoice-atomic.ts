import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

/** Exact string for SQL binding. Avoids float64 conversion of money values. */
function decimalParam(amount: Prisma.Decimal.Value): string {
  return new Prisma.Decimal(amount).toFixed();
}

/**
 * Atomically increase invoice.paid; rejects if payment would exceed total.
 * Returns false when the row was not updated (insufficient headroom or wrong tenant).
 */
export async function incrementInvoicePaid(
  tx: Prisma.TransactionClient,
  businessId: string,
  invoiceId: string,
  amount: Prisma.Decimal.Value,
): Promise<boolean> {
  const value = decimalParam(amount);
  const rows = await tx.$queryRaw<{ id: string }[]>`
    UPDATE "Invoice"
    SET "paid" = "paid" + ${value}::decimal
    WHERE "id" = ${invoiceId}
      AND "businessId" = ${businessId}
      AND ("paid" + ${value}::decimal) <= "total"
    RETURNING "id"
  `;
  return rows.length > 0;
}

export async function incrementInvoicePaidOrThrow(
  tx: Prisma.TransactionClient,
  businessId: string,
  invoiceId: string,
  amount: Prisma.Decimal.Value,
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
  amount: Prisma.Decimal.Value,
  goodsTotal: Prisma.Decimal.Value,
): Promise<boolean> {
  const value = decimalParam(amount);
  const goods = decimalParam(goodsTotal);
  const rows = await tx.$queryRaw<{ id: string }[]>`
    UPDATE "Purchase"
    SET "paid" = "paid" + ${value}::decimal
    WHERE "id" = ${purchaseId}
      AND "businessId" = ${businessId}
      AND ("paid" + ${value}::decimal) <= ${goods}::decimal
    RETURNING "id"
  `;
  return rows.length > 0;
}
