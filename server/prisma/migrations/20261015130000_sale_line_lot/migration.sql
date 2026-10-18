-- AlterTable: optional exact source lot per sale line. Legacy rows stay NULL.
ALTER TABLE "SaleLine" ADD COLUMN "lotId" TEXT;

-- CreateIndex
CREATE INDEX "SaleLine_lotId_idx" ON "SaleLine"("lotId");

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "StockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
