-- Catalogue fields used by the dynamic UI.
ALTER TABLE "AttributeDef"
  ADD COLUMN "unit" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "AttributeOption" RENAME COLUMN "defId" TO "attributeDefId";
ALTER TABLE "AttributeOption" RENAME COLUMN "value" TO "label";
ALTER TABLE "AttributeOption"
  ADD COLUMN "value" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

DROP INDEX IF EXISTS "AttributeDef_productId_key_key";
CREATE UNIQUE INDEX "AttributeDef_productId_categoryId_key_key"
  ON "AttributeDef"("productId", "categoryId", "key");
DROP INDEX IF EXISTS "AttributeOption_defId_idx";
CREATE INDEX "AttributeDef_categoryId_idx" ON "AttributeDef"("categoryId");
CREATE INDEX "AttributeOption_attributeDefId_idx" ON "AttributeOption"("attributeDefId");
CREATE UNIQUE INDEX "AttributeOption_attributeDefId_label_key"
  ON "AttributeOption"("attributeDefId", "label");

UPDATE "AttributeDef" d SET "categoryId" = NULL
WHERE "categoryId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "ProductCategory" c WHERE c."id" = d."categoryId");
UPDATE "Variant" v SET "categoryId" = NULL
WHERE "categoryId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "ProductCategory" c WHERE c."id" = v."categoryId");

ALTER TABLE "AttributeOption"
  DROP CONSTRAINT IF EXISTS "AttributeOption_defId_fkey";
ALTER TABLE "AttributeOption"
  ADD CONSTRAINT "AttributeOption_attributeDefId_fkey"
  FOREIGN KEY ("attributeDefId") REFERENCES "AttributeDef"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributeDef"
  ADD CONSTRAINT "AttributeDef_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Variant"
  ADD CONSTRAINT "Variant_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Lot/location traceability.
ALTER TABLE "PurchaseLine"
  ADD COLUMN "productName" TEXT,
  ADD COLUMN "spec" TEXT,
  ADD COLUMN "quality" TEXT,
  ADD COLUMN "lotNumber" TEXT,
  ADD COLUMN "heatNumber" TEXT,
  ADD COLUMN "batchNumber" TEXT,
  ADD COLUMN "warehouseId" TEXT,
  ADD COLUMN "locationId" TEXT;

CREATE INDEX "PurchaseLine_variantId_idx" ON "PurchaseLine"("variantId");
CREATE INDEX "PurchaseLine_warehouseId_idx" ON "PurchaseLine"("warehouseId");
CREATE INDEX "PurchaseLine_locationId_idx" ON "PurchaseLine"("locationId");
CREATE INDEX "SaleLine_variantId_idx" ON "SaleLine"("variantId");
CREATE INDEX "SaleLine_purchaseId_idx" ON "SaleLine"("purchaseId");

UPDATE "PurchaseLine" l SET "variantId" = NULL
WHERE "variantId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Variant" v WHERE v."id" = l."variantId");
UPDATE "SaleLine" l SET "variantId" = NULL
WHERE "variantId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Variant" v WHERE v."id" = l."variantId");
UPDATE "SaleLine" l SET "purchaseId" = NULL
WHERE "purchaseId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Purchase" p WHERE p."id" = l."purchaseId");

ALTER TABLE "PurchaseLine"
  ADD CONSTRAINT "PurchaseLine_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "Variant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseLine"
  ADD CONSTRAINT "PurchaseLine_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseLine"
  ADD CONSTRAINT "PurchaseLine_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleLine"
  ADD CONSTRAINT "SaleLine_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "Variant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleLine"
  ADD CONSTRAINT "SaleLine_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Location"
  ADD CONSTRAINT "Location_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Location_businessId_idx" ON "Location"("businessId");
CREATE UNIQUE INDEX "Location_warehouseId_name_key" ON "Location"("warehouseId", "name");

ALTER TABLE "StockCheck" ADD COLUMN "note" TEXT;

-- A stock movement now contains enough identity to answer variant and lot views.
ALTER TABLE "InventoryTransaction"
  ADD COLUMN "categoryId" TEXT,
  ADD COLUMN "variantId" TEXT,
  ADD COLUMN "purchaseLineId" TEXT,
  ADD COLUMN "saleLineId" TEXT,
  ADD COLUMN "warehouseId" TEXT,
  ADD COLUMN "locationId" TEXT,
  ADD COLUMN "attributeSnapshot" JSONB,
  ADD COLUMN "unit" TEXT,
  ADD COLUMN "refLabel" TEXT;

UPDATE "InventoryTransaction" tx
SET "unit" = p."unit"
FROM "Product" p
WHERE tx."productId" = p."id";
ALTER TABLE "InventoryTransaction" ALTER COLUMN "unit" SET NOT NULL;

CREATE INDEX "InventoryTransaction_businessId_variantId_date_idx"
  ON "InventoryTransaction"("businessId", "variantId", "date");
CREATE INDEX "InventoryTransaction_purchaseLineId_idx"
  ON "InventoryTransaction"("purchaseLineId");
CREATE INDEX "InventoryTransaction_saleLineId_idx"
  ON "InventoryTransaction"("saleLineId");

ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "InventoryTransaction_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "Variant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "InventoryTransaction_purchaseLineId_fkey"
  FOREIGN KEY ("purchaseLineId") REFERENCES "PurchaseLine"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "InventoryTransaction_saleLineId_fkey"
  FOREIGN KEY ("saleLineId") REFERENCES "SaleLine"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "InventoryTransaction_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "InventoryTransaction_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
