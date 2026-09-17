-- Subscription plans and product template assignment for platform admin
CREATE TYPE "SubscriptionPlan" AS ENUM ('MONTHLY', 'YEARLY', 'LIFETIME');
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED');

ALTER TABLE "Business"
  ADD COLUMN "subscriptionPlan" "SubscriptionPlan",
  ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "subscriptionStartsAt" TIMESTAMP(3),
  ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3),
  ADD COLUMN "assignedTemplateIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "templatesAppliedAt" TIMESTAMP(3);
