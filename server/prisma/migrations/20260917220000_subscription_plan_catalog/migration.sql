-- Customizable subscription plan catalog (replaces fixed SubscriptionPlan enum on Business)
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY', 'LIFETIME', 'CUSTOM_DAYS');

CREATE TABLE "SubscriptionPlanDefinition" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "durationDays" INTEGER,
    "description" TEXT,
    "price" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlanDefinition_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SubscriptionPlanDefinition" ("id", "label", "billingCycle", "description", "sortOrder", "updatedAt")
VALUES
    ('sub_monthly', 'Monthly', 'MONTHLY', 'Renews every month', 1, CURRENT_TIMESTAMP),
    ('sub_yearly', 'Yearly', 'YEARLY', 'Renews every year', 2, CURRENT_TIMESTAMP),
    ('sub_lifetime', 'Lifetime access', 'LIFETIME', 'No expiry date', 3, CURRENT_TIMESTAMP);

ALTER TABLE "Business" ADD COLUMN "subscriptionPlanId" TEXT;

UPDATE "Business"
SET "subscriptionPlanId" = CASE "subscriptionPlan"
    WHEN 'MONTHLY' THEN 'sub_monthly'
    WHEN 'YEARLY' THEN 'sub_yearly'
    WHEN 'LIFETIME' THEN 'sub_lifetime'
    ELSE 'sub_monthly'
END
WHERE "subscriptionPlan" IS NOT NULL;

UPDATE "Business" SET "subscriptionPlanId" = 'sub_monthly' WHERE "subscriptionPlanId" IS NULL;

ALTER TABLE "Business" ADD CONSTRAINT "Business_subscriptionPlanId_fkey"
    FOREIGN KEY ("subscriptionPlanId") REFERENCES "SubscriptionPlanDefinition"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Business" DROP COLUMN "subscriptionPlan";

DROP TYPE "SubscriptionPlan";
