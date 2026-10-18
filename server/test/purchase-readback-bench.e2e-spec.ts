import { PrismaClient, Prisma } from "@prisma/client";
import { AuditService } from "../src/common/audit/audit.service";
import { CreatePurchaseDto } from "../src/purchases/dto/create-purchase.dto";
import { PrismaService } from "../src/prisma/prisma.service";
import { PurchasesService } from "../src/purchases/purchases.service";
import { PurchasesService as ReadbackPurchasesService } from "../src/purchases/purchases.service.readback-bench";

/**
 * Purchase create benchmark: current code vs same code plus the old line readback.
 *
 * Runs ONLY against the tijaratt_test database (Neon), URL passed in
 * BENCH_DATABASE_URL. Creates BENCH businesses; deletes nothing.
 *
 * BENCH_VARIANT=readback  uses the copy that re-reads purchase lines before responding.
 * BENCH_VARIANT=current   uses the current service (no readback).
 */
const SAFE_DB_NAME = "tijaratt_test";
const benchUrl = process.env.BENCH_DATABASE_URL ?? "";
const variant = process.env.BENCH_VARIANT ?? "current";
const WARMUP = 3;
const MEASURED = 15;

function isSafeNeonTestDb(url: string): boolean {
  try {
    const parsed = new URL(url);
    const name = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    return parsed.hostname.endsWith(".neon.tech") && name === SAFE_DB_NAME;
  } catch {
    return false;
  }
}

const describeIfSafe = benchUrl && isSafeNeonTestDb(benchUrl) ? describe : describe.skip;

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

describeIfSafe("purchase create benchmark (tijaratt_test)", () => {
  it(`runs the ${variant} variant`, async () => {
    const counter = { queries: 0 };
    const client = new PrismaClient({
      datasources: { db: { url: benchUrl } },
      log: [{ emit: "event", level: "query" }],
    });
    client.$on("query", (_e: Prisma.QueryEvent) => {
      counter.queries += 1;
    });
    await client.$connect();
    const [{ name }] = await client.$queryRaw<{ name: string }[]>`
      SELECT current_database() AS name`;
    if (name !== SAFE_DB_NAME) {
      throw new Error(`Refusing to run: connected to database "${name}"`);
    }

    const prisma = client as unknown as PrismaService;
    const Service = variant === "readback" ? ReadbackPurchasesService : PurchasesService;
    const service = new Service(prisma, new AuditService(prisma));

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
    const failures: string[] = [];
    const total = WARMUP + MEASURED;
    for (let i = 0; i < total; i++) {
      counter.queries = 0;
      const start = performance.now();
      try {
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
        const lots = await client.stockLot.count({ where: { purchaseId: purchase.id } });
        const ledger = await client.inventoryTransaction.count({
          where: { referenceId: purchase.id, businessId: business.id },
        });
        if (lots !== 3 || ledger !== 3) {
          failures.push(`run ${i}: expected 3 lots and 3 ledger rows, got ${lots}/${ledger}`);
        }
        if (i >= WARMUP) {
          samples.push(elapsed);
          queryCounts.push(counter.queries);
        }
      } catch (err) {
        failures.push(`run ${i}: ${(err as Error).message}`);
      }
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const summary = {
      variant,
      measured: samples.length,
      medianMs: sorted.length ? Number(percentile(sorted, 50).toFixed(1)) : null,
      p95Ms: sorted.length ? Number(percentile(sorted, 95).toFixed(1)) : null,
      maxMs: sorted.length ? Number(sorted[sorted.length - 1].toFixed(1)) : null,
      queriesPerRun: [...new Set(queryCounts)],
      failures,
    };
    // eslint-disable-next-line no-console
    console.log(`BENCH_RESULT ${JSON.stringify(summary)}`);

    await client.$disconnect();
    expect(failures).toEqual([]);
    expect(samples).toHaveLength(MEASURED);
  }, 600000);
});
