CREATE TABLE "BusinessLedger" (
  "businessId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BusinessLedger_pkey" PRIMARY KEY ("businessId")
);

ALTER TABLE "BusinessLedger"
ADD CONSTRAINT "BusinessLedger_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Business" ADD COLUMN "settings" JSONB;
