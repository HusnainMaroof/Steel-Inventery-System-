-- Subscription plan → business panel module access
ALTER TABLE "SubscriptionPlanDefinition" ADD COLUMN "allowedPages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "SubscriptionPlanDefinition"
SET "allowedPages" = ARRAY[
  'dashboard',
  'purchases',
  'products',
  'inventory',
  'sales',
  'customers',
  'suppliers',
  'payments',
  'expenses',
  'reports',
  'staff',
  'settings'
]::TEXT[]
WHERE cardinality("allowedPages") = 0;
