-- Speed up tenant-scoped invoice / dues queries in reports.
CREATE INDEX "Invoice_businessId_idx" ON "Invoice"("businessId");
