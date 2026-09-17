-- Improve list and dues query performance
CREATE INDEX IF NOT EXISTS "Invoice_businessId_createdAt_idx" ON "Invoice"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "Payment_saleId_idx" ON "Payment"("saleId");
CREATE INDEX IF NOT EXISTS "Payment_businessId_type_date_idx" ON "Payment"("businessId", "type", "date");
