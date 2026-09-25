-- Link supplier payments to specific purchases (dues tab + audit trail).

ALTER TABLE "Payment" ADD COLUMN "purchaseId" TEXT;

ALTER TABLE "PaymentAllocation" ADD COLUMN "purchaseId" TEXT;
ALTER TABLE "PaymentAllocation" ALTER COLUMN "saleId" DROP NOT NULL;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentAllocation"
  ADD CONSTRAINT "PaymentAllocation_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Payment_purchaseId_idx" ON "Payment"("purchaseId");
CREATE INDEX "PaymentAllocation_purchaseId_idx" ON "PaymentAllocation"("purchaseId");
