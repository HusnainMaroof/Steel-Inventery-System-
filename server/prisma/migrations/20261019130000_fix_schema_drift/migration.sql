-- Bring the database in line with schema.prisma.

-- 1. BusinessLedger held the old JSON ledger snapshot. Nothing reads or writes it
--    since 20260917130000_remove_legacy_ledger_snapshot, but the table was never dropped.
ALTER TABLE IF EXISTS "BusinessLedger" DROP CONSTRAINT IF EXISTS "BusinessLedger_businessId_fkey";
DROP TABLE IF EXISTS "BusinessLedger";

-- 2. Deleting a warehouse removes its locations. The live constraint was RESTRICT,
--    so a warehouse with any location could not be deleted. References to a location
--    from purchase lines and ledger rows are SET NULL, so no history row is removed.
ALTER TABLE "Location" DROP CONSTRAINT "Location_warehouseId_fkey";
ALTER TABLE "Location" ADD CONSTRAINT "Location_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
