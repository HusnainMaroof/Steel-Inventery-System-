-- Per-business invoice counter. Numbers are issued by incrementing this row,
-- so a deleted invoice's number is never reused.
ALTER TABLE "Business" ADD COLUMN "invoiceSeq" INTEGER NOT NULL DEFAULT 0;

-- Backfill: start each business at its highest existing INV-NNNN number.
UPDATE "Business" b
SET "invoiceSeq" = s.max
FROM (
  SELECT "businessId", MAX(CAST(SUBSTRING("number" FROM 5) AS INTEGER)) AS max
  FROM "Invoice"
  WHERE "number" ~ '^INV-[0-9]+$'
  GROUP BY "businessId"
) s
WHERE s."businessId" = b."id";
