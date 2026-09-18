/**
 * Runs EXPLAIN (ANALYZE, BUFFERS) on critical PostgreSQL queries.
 *
 * Usage:
 *   node scripts/explain-audit.mjs
 *   BUSINESS_ID=<cuid> node scripts/explain-audit.mjs
 *
 * Requires DIRECT_URL or DATABASE_URL (non-pooled preferred for EXPLAIN).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
});

async function explain(label, sql, ...params) {
  console.log(`\n=== ${label} ===`);
  const rows = await prisma.$queryRawUnsafe(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
    ...params,
  );
  for (const row of rows) {
    console.log(row["QUERY PLAN"] ?? row);
  }
}

async function main() {
  const business =
    process.env.BUSINESS_ID
      ? { id: process.env.BUSINESS_ID }
      : await prisma.business.findFirst({ select: { id: true } });

  if (!business?.id) {
    console.error("No business found. Seed data or set BUSINESS_ID.");
    process.exit(1);
  }

  const businessId = business.id;
  const since = new Date();
  since.setDate(since.getDate() - 30);

  console.log(`EXPLAIN audit for businessId=${businessId}`);

  await explain(
    "Sales list (paginated)",
    `
    SELECT s.*
    FROM "Sale" s
    WHERE s."businessId" = $1
    ORDER BY s.date DESC, s."createdAt" DESC
    LIMIT 50 OFFSET 0
    `,
    businessId,
  );

  await explain(
    "Customer FIFO open invoices",
    `
    SELECT s.id, s.date, i.total, i.paid
    FROM "Sale" s
    INNER JOIN "Invoice" i ON i."saleId" = s.id
    WHERE s."businessId" = $1
      AND s."customerId" = (
        SELECT c.id FROM "Customer" c
        WHERE c."businessId" = $1
        LIMIT 1
      )
      AND i.total > 0
    ORDER BY s.date ASC
    `,
    businessId,
  );

  await explain(
    "Supplier FIFO open purchases",
    `
    SELECT p.id, p.paid,
      COALESCE((
        SELECT SUM(pl.qty * pl.rate)
        FROM "PurchaseLine" pl
        WHERE pl."purchaseId" = p.id
      ), 0) AS goods
    FROM "Purchase" p
    WHERE p."businessId" = $1
      AND p."supplierId" = (
        SELECT sp.id FROM "Supplier" sp
        WHERE sp."businessId" = $1
        LIMIT 1
      )
    ORDER BY p.date ASC, p."createdAt" ASC
    `,
    businessId,
  );

  await explain(
    "Lot consumption aggregate",
    `
    SELECT sl."purchaseId", sl."productId", sl."variantId", SUM(sl.qty) AS qty
    FROM "SaleLine" sl
    INNER JOIN "Sale" s ON s.id = sl."saleId"
    WHERE s."businessId" = $1
      AND sl."purchaseId" IS NOT NULL
    GROUP BY sl."purchaseId", sl."productId", sl."variantId"
    `,
    businessId,
  );

  await explain(
    "Dashboard invoice dues",
    `
    SELECT COALESCE(SUM(total), 0) AS total,
           COALESCE(SUM(paid), 0) AS paid
    FROM "Invoice"
    WHERE "businessId" = $1
    `,
    businessId,
  );

  await explain(
    "Inventory movements (paginated)",
    `
    SELECT *
    FROM "InventoryTransaction"
    WHERE "businessId" = $1
    ORDER BY date DESC, "createdAt" DESC
    LIMIT 50 OFFSET 0
    `,
    businessId,
  );

  await explain(
    "Platform 30d sales by business",
    `
    SELECT "businessId", COUNT(*)::int AS cnt
    FROM "Sale"
    WHERE date >= $1
    GROUP BY "businessId"
    `,
    since,
  );

  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
