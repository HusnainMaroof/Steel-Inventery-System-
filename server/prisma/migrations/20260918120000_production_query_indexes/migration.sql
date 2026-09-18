-- Composite indexes aligned to FIFO, list, and lot-consumption query patterns.

CREATE INDEX IF NOT EXISTS "Customer_businessId_createdAt_idx"
  ON "Customer"("businessId", "createdAt");

CREATE INDEX IF NOT EXISTS "Supplier_businessId_createdAt_idx"
  ON "Supplier"("businessId", "createdAt");

CREATE INDEX IF NOT EXISTS "Purchase_businessId_supplierId_date_idx"
  ON "Purchase"("businessId", "supplierId", "date");

CREATE INDEX IF NOT EXISTS "Sale_businessId_customerId_date_idx"
  ON "Sale"("businessId", "customerId", "date");

CREATE INDEX IF NOT EXISTS "Sale_businessId_createdAt_idx"
  ON "Sale"("businessId", "createdAt");

CREATE INDEX IF NOT EXISTS "SaleLine_purchaseId_productId_variantId_idx"
  ON "SaleLine"("purchaseId", "productId", "variantId");

CREATE INDEX IF NOT EXISTS "InventoryTransaction_businessId_productId_date_idx"
  ON "InventoryTransaction"("businessId", "productId", "date");
