-- Tenant-safe SaleLine integrity.
-- 1. Add businessId, backfilled from the parent Sale (no invented data).
ALTER TABLE "SaleLine" ADD COLUMN "businessId" TEXT;

UPDATE "SaleLine" AS sl
SET "businessId" = s."businessId"
FROM "Sale" AS s
WHERE s."id" = sl."saleId";

ALTER TABLE "SaleLine" ALTER COLUMN "businessId" SET NOT NULL;

-- 2. Pre-check: abort with a clear message if any historical lot link crosses tenants.
-- Nothing is rewritten here; the operator must fix the rows before retrying.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "SaleLine" AS sl
    JOIN "StockLot" AS l ON l."id" = sl."lotId"
    WHERE sl."lotId" IS NOT NULL AND l."businessId" <> sl."businessId"
  ) THEN
    RAISE EXCEPTION 'SaleLine.lotId points at a StockLot of another business; fix the data before this migration';
  END IF;
END $$;

-- 3. Replace single-column FKs with tenant-scoped composite FKs.
ALTER TABLE "SaleLine" DROP CONSTRAINT "SaleLine_saleId_fkey";
ALTER TABLE "SaleLine" DROP CONSTRAINT "SaleLine_lotId_fkey";

-- CreateIndex (composite FK target on Sale)
CREATE UNIQUE INDEX "Sale_id_businessId_key" ON "Sale"("id", "businessId");

-- CreateIndex
CREATE INDEX "SaleLine_businessId_lotId_idx" ON "SaleLine"("businessId", "lotId");

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_saleId_businessId_fkey" FOREIGN KEY ("saleId", "businessId") REFERENCES "Sale"("id", "businessId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_businessId_lotId_fkey" FOREIGN KEY ("businessId", "lotId") REFERENCES "StockLot"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
