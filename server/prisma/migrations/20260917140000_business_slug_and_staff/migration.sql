-- Business URLs: /{slug}/dashboard
ALTER TABLE "Business" ADD COLUMN "slug" TEXT;

UPDATE "Business"
SET "slug" = trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'))
WHERE "slug" IS NULL;

UPDATE "Business"
SET "slug" = 'business-' || substr("id", 1, 8)
WHERE "slug" IS NULL OR "slug" = '';

UPDATE "Business" b
SET "slug" = b."slug" || '-' || substr(b."id", 1, 4)
WHERE EXISTS (
  SELECT 1 FROM "Business" x
  WHERE x."slug" = b."slug" AND x."id" <> b."id"
);

ALTER TABLE "Business" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");

-- Staff logins for business owners
ALTER TABLE "User" ADD COLUMN "title" TEXT;
ALTER TABLE "User" ADD COLUMN "access" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
CREATE TYPE "Role_with_staff" AS ENUM ('ADMIN', 'SUBADMIN', 'SUPERADMIN');
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role_with_staff"
  USING ("role"::text::"Role_with_staff");
DROP TYPE "Role";
ALTER TYPE "Role_with_staff" RENAME TO "Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ADMIN';
