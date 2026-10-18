-- AlterTable
ALTER TABLE "InventoryTransaction" ADD COLUMN     "lotId" TEXT;

-- CreateTable
CREATE TABLE "StockLot" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "purchaseLineId" TEXT,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "unit" TEXT NOT NULL,
    "receivedQty" DECIMAL(14,3) NOT NULL,
    "receivedAt" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockLot_businessId_purchaseId_idx" ON "StockLot"("businessId", "purchaseId");

-- CreateIndex
CREATE INDEX "StockLot_businessId_purchaseLineId_idx" ON "StockLot"("businessId", "purchaseLineId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLot_businessId_id_key" ON "StockLot"("businessId", "id");

-- CreateIndex
CREATE INDEX "InventoryTransaction_businessId_lotId_idx" ON "InventoryTransaction"("businessId", "lotId");

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_businessId_lotId_fkey" FOREIGN KEY ("businessId", "lotId") REFERENCES "StockLot"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
