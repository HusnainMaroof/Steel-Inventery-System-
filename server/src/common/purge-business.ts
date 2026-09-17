import type { Prisma } from "@prisma/client";

/** Permanently remove a business and every tenant record tied to it. */
export async function purgeBusiness(
  tx: Prisma.TransactionClient,
  businessId: string,
): Promise<void> {
  await tx.paymentAllocation.deleteMany({ where: { businessId } });
  await tx.payment.deleteMany({ where: { businessId } });
  await tx.invoice.deleteMany({ where: { businessId } });
  await tx.inventoryTransaction.deleteMany({ where: { businessId } });
  await tx.sale.deleteMany({ where: { businessId } });
  await tx.purchase.deleteMany({ where: { businessId } });
  await tx.stockCheck.deleteMany({ where: { businessId } });
  await tx.expense.deleteMany({ where: { businessId } });
  await tx.attributeDef.deleteMany({ where: { businessId } });
  await tx.variant.deleteMany({ where: { businessId } });
  await tx.productItem.deleteMany({ where: { businessId } });
  await tx.productCategory.deleteMany({ where: { businessId } });
  await tx.product.deleteMany({ where: { businessId } });
  await tx.location.deleteMany({ where: { businessId } });
  await tx.warehouse.deleteMany({ where: { businessId } });
  await tx.supplier.deleteMany({ where: { businessId } });
  await tx.customer.deleteMany({ where: { businessId } });
  await tx.user.deleteMany({ where: { businessId } });
  await tx.business.delete({ where: { id: businessId } });
}
