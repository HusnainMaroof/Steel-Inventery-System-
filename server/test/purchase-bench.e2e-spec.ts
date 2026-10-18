import { PrismaClient, Prisma } from "@prisma/client";
import { AuditService } from "../src/common/audit/audit.service";
import { ConfigService } from "../src/config/config.service";
import { CreatePurchaseDto } from "../src/purchases/dto/create-purchase.dto";
import { PrismaService } from "../src/prisma/prisma.service";
import { PurchasesService } from "../src/purchases/purchases.service";

/**
 * Purchase create benchmark (service layer, real PostgreSQL).
 *
 * Runs ONLY against the disposable scratch database (port 55435, database
 * "tijaratt_stock_lot_scratch"), same gate as the other scratch specs.
 *
 * BENCH_VARIANT=before  replaces createLots with the old per-line stockLot.create loop.
 * BENCH_VARIANT=after   uses the current code (one stockLot.createMany).
 * Workload: 3 lines, no payment, 3 warm-up + 15 measured runs.
 */
const SAFE_DB_NAME = "tijaratt_stock_lot_scratch";
const SAFE_PORT = "55435";
const testDbUrl = process.env.STOCK_LOT_TEST_DATABASE_URL ?? "";
const variant = process.env.BENCH_VARIANT ?? "after";
const WARMUP = 3;
const MEASURED = 15;

function isSafeLocalTestDb(url: string): boolean {
  try {
    const parsed = new URL(url);
    const local = ["127.0.0.1", "localhost"].includes(parsed.hostname);
    const name = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    return local && parsed.port === SAFE_PORT && name === SAFE_DB_NAME;
  } catch {
    return false;
  }
}

const describeIfSafe =
  testDbUrl && isSafeLocalTestDb(testDbUrl) ? describe : describe.skip;

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

describeIfSafe("purchase create benchmark (disposable local DB)", () => {
  it(`runs the ${variant} variant and reports latency and query counts`, async () => {
    const counter = { queries: 0, dbMs: 0 };
    const client = new PrismaClient({
      datasources: { db: { url: testDbUrl } },
      log: [{ emit: "event", level: "query" }],
    });
    client.$on("query", (e: Prisma.QueryEvent) => {
      counter.queries += 1;
      counter.dbMs += e.duration;
    });
    await client.$connect();
    const [{ name }] = await client.$queryRaw<{ name: string }[]>`
      SELECT current_database() AS name`;
    if (name !== SAFE_DB_NAME) {
      throw new Error(`Refusing to run: connected to database "${name}"`);
    }

    const prisma = client as unknown as PrismaService;
    const service = new PurchasesService(prisma, new AuditService(prisma));

    if (variant === "before") {
      // Old behaviour: one stockLot.create per line, same data as before batching.
      jest
        .spyOn(service as any, "createLots")
        .mockImplementation(async (...args: unknown[]) => {
          const [tx, businessId, purchaseId, lines, receivedAt] = args as [
            any,
            string,
            string,
            Array<{ id: string; productId: string; variantId: string | null; unit: string; qty: Prisma.Decimal }>,
            Date,
          ];
          const lotIdByLine = new Map<string, string>();
          for (const line of lines) {
            const lot = await tx.stockLot.create({
              data: {
                businessId,
                purchaseId,
                purchaseLineId: line.id,
                productId: line.productId,
                variantId: line.variantId,
                unit: line.unit,
                receivedQty: line.qty,
                receivedAt,
                status: "ACTIVE",
              },
              select: { id: true },
            });
            lotIdByLine.set(line.id, lot.id);
          }
          return lotIdByLine;
        });
    }

    const stamp = Date.now().toString(36);
    const business = await client.business.create({
      data: { name: `BENCH ${stamp}`, slug: `bench-${stamp}` },
    });
    const supplier = await client.supplier.create({
      data: { businessId: business.id, name: "Bench supplier", mill: "Mill", phone: "0300" },
    });
    const product = await client.product.create({
      data: { businessId: business.id, name: "Bench rod", unit: "kg" },
    });

    const samples: number[] = [];
    const queryCounts: number[] = [];
    const dbMsTotals: number[] = [];
    const total = WARMUP + MEASURED;
    for (let i = 0; i < total; i++) {
      counter.queries = 0;
      counter.dbMs = 0;
      const start = performance.now();
      const purchase = await service.create(
        business.id,
        {
          date: "2026-10-01",
          supplierId: supplier.id,
          paid: 0,
          lines: [1, 2.5, 3.125].map((qty) => ({
            productId: product.id,
            item: "Bench rod",
            qty,
            unit: "kg",
            rate: 50,
          })),
        } as unknown as CreatePurchaseDto,
      );
      const elapsed = performance.now() - start;

      const lots = await client.stockLot.findMany({ where: { purchaseId: purchase.id } });
      const ledger = await client.inventoryTransaction.findMany({
        where: { referenceId: purchase.id, businessId: business.id },
      });
      if (lots.length !== 3 || ledger.length !== 3) {
        throw new Error(`run ${i}: expected 3 lots and 3 ledger rows, got ${lots.length}/${ledger.length}`);
      }
      if (i >= WARMUP) {
        samples.push(elapsed);
        queryCounts.push(counter.queries);
        dbMsTotals.push(counter.dbMs);
      }
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const summary = {
      variant,
      warmup: WARMUP,
      measured: MEASURED,
      medianMs: Number(percentile(sorted, 50).toFixed(1)),
      p95Ms: Number(percentile(sorted, 95).toFixed(1)),
      maxMs: Number(sorted[sorted.length - 1].toFixed(1)),
      queriesPerRun: [...new Set(queryCounts)],
      dbMsMedian: Number(percentile([...dbMsTotals].sort((a, b) => a - b), 50).toFixed(1)),
    };
    // eslint-disable-next-line no-console
    console.log(`BENCH_RESULT ${JSON.stringify(summary)}`);

    await client.$disconnect();
    expect(samples).toHaveLength(MEASURED);
  }, 600000);
});
