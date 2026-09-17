-- Drop plaintext password column (passwords cannot be recovered; owners must reset via admin)
ALTER TABLE "User" DROP COLUMN IF EXISTS "loginPassword";

-- JWT invalidation version
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Audit trail for financially significant mutations
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_businessId_createdAt_idx" ON "AuditLog"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- Payment.saleId foreign key (nullify on sale delete; targeted payments keep history via allocations)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_saleId_fkey'
  ) THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey"
      FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Business invariants (amounts non-negative; paid cannot exceed total)
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_paid_non_negative";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paid_non_negative" CHECK ("paid" >= 0);
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_paid_lte_total";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paid_lte_total" CHECK ("paid" <= "total");
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_total_non_negative";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_total_non_negative" CHECK ("total" >= 0);

ALTER TABLE "Purchase" DROP CONSTRAINT IF EXISTS "Purchase_paid_non_negative";
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_paid_non_negative" CHECK ("paid" >= 0);

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_amount_positive";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_amount_positive";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_amount_positive" CHECK ("amount" > 0);

-- Indexes for common tenant queries
CREATE INDEX IF NOT EXISTS "StockCheck_businessId_date_idx" ON "StockCheck"("businessId", "date");
CREATE INDEX IF NOT EXISTS "Variant_businessId_idx" ON "Variant"("businessId");
CREATE INDEX IF NOT EXISTS "PaymentAllocation_businessId_idx" ON "PaymentAllocation"("businessId");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_businessId_productId_idx" ON "InventoryTransaction"("businessId", "productId");
