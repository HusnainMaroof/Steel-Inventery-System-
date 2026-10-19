-- Idempotent sale create: one sale per (business, client request key).
-- Existing rows keep NULL, and NULLs never conflict in a unique index.
ALTER TABLE "Sale" ADD COLUMN "clientRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_businessId_clientRequestId_key" ON "Sale"("businessId", "clientRequestId");
