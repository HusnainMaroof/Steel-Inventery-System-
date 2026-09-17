-- Business owners remain the only tenant logins. Staff login rows do not own
-- ledger records, so removing them does not remove business data.
DELETE FROM "User" WHERE "role" = 'SUBADMIN';

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
CREATE TYPE "Role_simplified" AS ENUM ('ADMIN', 'SUPERADMIN');
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role_simplified"
  USING ("role"::text::"Role_simplified");
DROP TYPE "Role";
ALTER TYPE "Role_simplified" RENAME TO "Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ADMIN';
ALTER TABLE "User" DROP COLUMN "title";
ALTER TABLE "User" DROP COLUMN "access";

-- Revoking an owner must preserve the business and its complete ledger.
ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
