-- AlterTable
ALTER TABLE "User" ADD COLUMN "title" TEXT;
ALTER TABLE "User" ADD COLUMN "access" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Existing staff keep every page until the owner narrows them.
UPDATE "User"
SET "access" = ARRAY[
  'dashboard',
  'purchases',
  'products',
  'inventory',
  'sales',
  'customers',
  'suppliers',
  'payments',
  'reports'
]::TEXT[]
WHERE "role" = 'SUBADMIN';
