import { AuditService } from "../src/common/audit/audit.service";
import { ConfigService } from "../src/config/config.service";
import { CreatePurchaseDto } from "../src/purchases/dto/create-purchase.dto";
import { UpdatePurchaseDto } from "../src/purchases/dto/update-purchase.dto";
import { PrismaService } from "../src/prisma/prisma.service";
import { PurchasesService } from "../src/purchases/purchases.service";
import { SalesService } from "../src/sales/sales.service";
import { InventoryService } from "../src/inventory/inventory.service";
import { AdjustInventoryDto } from "../src/inventory/dto/adjust-inventory.dto";
import { CreateSaleDto } from "../src/sales/dto/create-sale.dto";
import { lockInventoryKeys, stockLockKey } from "../src/common/inventory/stock-locks";

/**
 * Stock locking under concurrency (real PostgreSQL).
 *
 * Runs ONLY against the disposable local scratch database. It is skipped
 * unless STOCK_LOT_TEST_DATABASE_URL points at 127.0.0.1 or localhost,
 * port 55435, database "tijaratt_stock_lot_scratch". It never reads
 * DATABASE_URL or DIRECT_URL from the environment or .env files.
 */
const SAFE_DB_NAME = "tijaratt_stock_lot_scratch";
const SAFE_PORT = "55435";
const testDbUrl = process.env.STOCK_LOT_TEST_DATABASE_URL ?? "";

function isSafeLocalTestDb(url: string): boolean {
  try {
    const parsed = new URL(url);
    // E2E_ALLOW_REMOTE_SCRATCH=1 allows a scratch database on a remote test server
    // (for example the Neon test project). The database-name checks still apply.
    const remote = process.env.E2E_ALLOW_REMOTE_SCRATCH === "1";
    const local = remote || ["127.0.0.1", "localhost"].includes(parsed.hostname);
    const name = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    return local && (remote || parsed.port === SAFE_PORT) && name === SAFE_DB_NAME;
  } catch {
    return false;
  }
}

const describeIfSafe =
  testDbUrl && isSafeLocalTestDb(testDbUrl) ? describe : describe.skip;

describeIfSafe("Stock locking under concurrency (e2e, disposable local DB)", () => {
  let prisma: PrismaService;
  let purchases: PurchasesService;
  let sales: SalesService;
  let inventory: InventoryService;

  const run0 = Date.now();
  let seq = 0;

  type Fixture = {
    businessId: string;
    otherBusinessId: string;
    supplierId: string;
    customerId: string;
    productId: string;
    variantId: string;
    otherProductId: string;
  };

  const fixture = async (label: string): Promise<Fixture> => {
    const run = `${label}-${run0}-${++seq}-${Math.random().toString(36).slice(2, 6)}`;
    const business = await prisma.business.create({
      data: { name: `SC ${run}`, slug: `sc-${run}` },
    });
    const other = await prisma.business.create({
      data: { name: `SC other ${run}`, slug: `sc-other-${run}` },
    });
    const supplier = await prisma.supplier.create({
      data: { businessId: business.id, name: "Supplier", mill: "Mill", phone: "0300" },
    });
    const customer = await prisma.customer.create({
      data: { businessId: business.id, name: "Buyer", shop: "Shop", phone: "0333" },
    });
    const product = await prisma.product.create({
      data: { businessId: business.id, name: "Steel", unit: "kg" },
    });
    const variant = await prisma.variant.create({
      data: {
        businessId: business.id,
        productId: product.id,
        key: "size-8",
        attributes: { size: "8" },
        shortName: "8mm",
      },
    });
    const otherProduct = await prisma.product.create({
      data: { businessId: other.id, name: "Steel", unit: "kg" },
    });
    return {
      businessId: business.id,
      otherBusinessId: other.id,
      supplierId: supplier.id,
      customerId: customer.id,
      productId: product.id,
      variantId: variant.id,
      otherProductId: otherProduct.id,
    };
  };

  const buy = (
    f: Fixture,
    lines: Array<{ qty: number; variantId?: string }>,
  ) =>
    purchases.create(
      f.businessId,
      {
        date: "2026-10-01",
        supplierId: f.supplierId,
        paid: 0,
        lines: lines.map((line) => ({
          productId: f.productId,
          variantId: line.variantId,
          item: "Steel",
          qty: line.qty,
          unit: "kg",
          rate: 100,
        })),
      } as unknown as CreatePurchaseDto,
    );

  const sell = (
    f: Fixture,
    lines: Array<{ qty: number; variantId?: string; productId?: string }>,
  ) =>
    sales.create(f.businessId, {
      date: "2026-10-02",
      customerId: f.customerId,
      lines: lines.map((line) => ({
        productId: line.productId ?? f.productId,
        variantId: line.variantId,
        item: "Steel",
        qty: line.qty,
        unit: "kg",
        rate: 100,
      })),
    } as unknown as CreateSaleDto);

  const stockOf = async (businessId: string, productId: string, variantId?: string) => {
    const rows = await prisma.inventoryTransaction.findMany({
      where: { businessId, productId, ...(variantId ? { variantId } : {}) },
      select: { qty: true },
    });
    return rows.reduce((acc, r) => acc + Number(r.qty), 0);
  };

  /** Polls pg_stat_activity until some session is waiting on a lock. */
  const waitUntilSaleBlocked = async (timeoutMs = 15000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*) AS n FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if (Number(n) > 0) return;
      await new Promise((resolve) => setImmediate(resolve));
    }
    throw new Error("sale never blocked on the product lock");
  };

  const footprint = async (businessId: string) => ({
    sales: await prisma.sale.count({ where: { businessId } }),
    invoices: await prisma.invoice.count({ where: { businessId } }),
    purchases: await prisma.purchase.count({ where: { businessId } }),
    ledger: await prisma.inventoryTransaction.count({ where: { businessId } }),
    lots: await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM "StockLot" WHERE "businessId" = ${businessId}`.then(
      (rows) => Number(rows[0].n),
    ),
  });

  beforeAll(async () => {
    // Force every config path to the disposable DB. Nothing else is read.
    process.env.DATABASE_URL = testDbUrl;
    process.env.DIRECT_URL = testDbUrl;

    prisma = new PrismaService(new ConfigService());
    await prisma.$connect();

    const [{ name }] = await prisma.$queryRaw<{ name: string }[]>`
      SELECT current_database()::text AS name`;
    if (name !== SAFE_DB_NAME) {
      throw new Error(`Refusing to run: connected to database "${name}"`);
    }

    purchases = new PurchasesService(prisma, new AuditService(prisma));
    sales = new SalesService(prisma, new AuditService(prisma));
    inventory = new InventoryService(prisma);
  }, 60000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  }, 30000);

  it("parallel product-level sales against limited stock never oversell", async () => {
    const f = await fixture("oversell");
    await buy(f, [{ qty: 10 }]);

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => sell(f, [{ qty: 3 }])),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;

    expect(ok).toBeLessThanOrEqual(3);
    expect(ok).toBeGreaterThanOrEqual(1);
    const stock = await stockOf(f.businessId, f.productId);
    expect(stock).toBeCloseTo(10 - 3 * ok, 3);
    expect(stock).toBeGreaterThanOrEqual(0);
  });

  it("parallel variant sales against limited variant stock never oversell", async () => {
    const f = await fixture("variant-oversell");
    await buy(f, [{ qty: 4, variantId: f.variantId }]);

    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => sell(f, [{ qty: 2, variantId: f.variantId }])),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;

    expect(ok).toBeLessThanOrEqual(2);
    const stock = await stockOf(f.businessId, f.productId, f.variantId);
    expect(stock).toBeCloseTo(4 - 2 * ok, 3);
    expect(stock).toBeGreaterThanOrEqual(0);
  });

  it("variant sale and product-level sale racing on one product stay within total stock", async () => {
    const f = await fixture("mixed-level");
    await buy(f, [{ qty: 6, variantId: f.variantId }]);

    const results = await Promise.allSettled([
      sell(f, [{ qty: 4, variantId: f.variantId }]),
      sell(f, [{ qty: 4 }]),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled").length;

    expect(ok).toBe(1);
    expect(await stockOf(f.businessId, f.productId)).toBeCloseTo(2, 3);
  });

  it("sale racing a purchase delete never leaves negative stock", async () => {
    const f = await fixture("sale-vs-delete");
    const purchase = await buy(f, [{ qty: 10 }]);

    const results = await Promise.allSettled([
      sell(f, [{ qty: 8 }]),
      purchases.remove(f.businessId, purchase.id),
    ]);

    expect(await stockOf(f.businessId, f.productId)).toBeGreaterThanOrEqual(0);
    const deleted = results[1].status === "fulfilled";
    const purchaseRow = await prisma.purchase.findUnique({ where: { id: purchase.id } });
    expect(purchaseRow === null).toBe(deleted);
  });

  it("sale racing a purchase edit that shrinks stock never leaves negative stock", async () => {
    const f = await fixture("sale-vs-edit");
    const purchase = await buy(f, [{ qty: 10 }]);
    const line = await prisma.purchaseLine.findFirstOrThrow({
      where: { purchaseId: purchase.id },
    });

    await Promise.allSettled([
      sell(f, [{ qty: 8 }]),
      purchases.update(
        f.businessId,
        purchase.id,
        {
          lines: [
            { id: line.id, productId: f.productId, item: "Steel", qty: 2, unit: "kg", rate: 100 },
          ],
        } as unknown as UpdatePurchaseDto,
      ),
    ]);

    expect(await stockOf(f.businessId, f.productId)).toBeGreaterThanOrEqual(0);
  });

  it("sale waits behind a held product lock, then commits after release", async () => {
    const f = await fixture("barrier");
    await buy(f, [{ qty: 10 }]);

    // Barrier 1: holder signals once it owns the product-level lock.
    let signalLocked!: () => void;
    const locked = new Promise<void>((resolve) => (signalLocked = resolve));
    // Barrier 2: holder waits here until the sale is seen blocked on the lock.
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));

    const holder = prisma.$transaction(
      async (tx) => {
        await lockInventoryKeys(tx, [stockLockKey(f.businessId, f.productId, null)]);
        signalLocked();
        await released;
      },
      { timeout: 30000 },
    );
    await locked;

    const sale = sell(f, [{ qty: 8 }]);
    await waitUntilSaleBlocked();
    release();

    await Promise.all([holder, sale]);
    expect(await stockOf(f.businessId, f.productId)).toBeCloseTo(2, 3);
  });

  it("purchase edit cannot shrink one variant below its sold stock", async () => {
    const f = await fixture("edit-variant");
    const size10 = await prisma.variant.create({
      data: {
        businessId: f.businessId,
        productId: f.productId,
        key: "size-10",
        attributes: { size: "10" },
        shortName: "10mm",
      },
    });
    const purchase = await buy(f, [
      { qty: 10, variantId: f.variantId },
      { qty: 10, variantId: size10.id },
    ]);
    await sell(f, [{ qty: 8, variantId: f.variantId }]);
    const lines = await prisma.purchaseLine.findMany({
      where: { purchaseId: purchase.id },
      orderBy: { id: "asc" },
    });
    const lineFor = (variantId: string) => lines.find((l) => l.variantId === variantId)!;

    // Product total stays 12 - 8 + 0 = positive, but variant 8mm would go to -6.
    await expect(
      purchases.update(
        f.businessId,
        purchase.id,
        {
          lines: [
            {
              id: lineFor(f.variantId).id,
              productId: f.productId,
              variantId: f.variantId,
              item: "Steel",
              qty: 2,
              unit: "kg",
              rate: 100,
            },
            {
              id: lineFor(size10.id).id,
              productId: f.productId,
              variantId: size10.id,
              item: "Steel",
              qty: 10,
              unit: "kg",
              rate: 100,
            },
          ],
        } as unknown as UpdatePurchaseDto,
      ),
    ).rejects.toThrow();

    expect(await stockOf(f.businessId, f.productId, f.variantId)).toBeCloseTo(2, 3);
  });

  it("rejected oversell writes no sale, invoice, lot or ledger rows", async () => {
    const f = await fixture("reject");
    await buy(f, [{ qty: 5 }]);
    const before = await footprint(f.businessId);

    await expect(sell(f, [{ qty: 9 }])).rejects.toThrow();

    expect(await footprint(f.businessId)).toEqual(before);
    expect(await stockOf(f.businessId, f.productId)).toBeCloseTo(5, 3);
  });

  it("a sale with one bad line rolls back the valid line too", async () => {
    const f = await fixture("rollback");
    await buy(f, [{ qty: 5 }]);
    const before = await footprint(f.businessId);

    await expect(
      sell(f, [
        { qty: 1 },
        { qty: 1, productId: "missing-product-id" },
      ]),
    ).rejects.toThrow();

    expect(await footprint(f.businessId)).toEqual(before);
    expect(await stockOf(f.businessId, f.productId)).toBeCloseTo(5, 3);
  });

  it("tenant isolation: a sale cannot draw stock from another business product", async () => {
    const f = await fixture("tenant");
    await buy(f, [{ qty: 5 }]);
    const otherBefore = await stockOf(f.otherBusinessId, f.otherProductId);

    await expect(
      sell(f, [{ qty: 1, productId: f.otherProductId }]),
    ).rejects.toThrow();

    expect(await stockOf(f.otherBusinessId, f.otherProductId)).toBe(otherBefore);
    expect(await stockOf(f.businessId, f.productId)).toBeCloseTo(5, 3);
  });

  const invoiceNumbers = async (businessId: string) =>
    (await prisma.invoice.findMany({ where: { businessId }, select: { number: true } }))
      .map((i) => i.number)
      .sort();

  const expectedNumbers = (n: number) =>
    Array.from({ length: n }, (_, i) => `INV-${String(i + 1).padStart(4, "0")}`);

  const saleOf = (
    f: Fixture,
    productId: string,
    qty: number,
    extra: Record<string, unknown> = {},
  ) =>
    sales.create(f.businessId, {
      date: "2026-10-02",
      customerId: f.customerId,
      lines: [{ productId, item: "Rod", qty, unit: "kg", rate: 100 }],
      ...extra,
    } as unknown as CreateSaleDto);

  const productsWithStock = async (f: Fixture, count: number) => {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const p = await prisma.product.create({
        data: { businessId: f.businessId, name: `Rod ${i}`, unit: "kg" },
      });
      ids.push(p.id);
    }
    await purchases.create(
      f.businessId,
      {
        date: "2026-10-01",
        supplierId: f.supplierId,
        paid: 0,
        lines: ids.map((productId) => ({
          productId,
          item: "Rod",
          qty: 10,
          unit: "kg",
          rate: 100,
        })),
      } as unknown as CreatePurchaseDto,
    );
    return ids;
  };

  const adjust = (f: Fixture, qty: number, productId = f.productId) =>
    inventory.adjust(f.businessId, {
      productId,
      qty,
      date: "2026-10-03",
      reason: "Stock count",
    } as unknown as AdjustInventoryDto);

  const adjustmentRows = (businessId: string) =>
    prisma.inventoryTransaction.count({ where: { businessId, type: "ADJUSTMENT" } });

  it("parallel sales of different products get unique, consecutive invoice numbers", async () => {
    const f = await fixture("inv-unique");
    const ids = await productsWithStock(f, 8);

    const results = await Promise.allSettled(ids.map((id) => saleOf(f, id, 2)));

    expect(results.filter((r) => r.status === "rejected")).toEqual([]);
    expect(await invoiceNumbers(f.businessId)).toEqual(expectedNumbers(8));
  });

  it("failed sale after the invoice step leaves no invoice and no number gap", async () => {
    const f = await fixture("inv-rollback");
    const ids = await productsWithStock(f, 2);
    const before = await footprint(f.businessId);

    await expect(saleOf(f, ids[0], 1, { paidNow: 1000 })).rejects.toThrow(
      "exceeds the invoice total",
    );

    expect(await footprint(f.businessId)).toEqual(before);
    expect(await stockOf(f.businessId, ids[0])).toBeCloseTo(10, 3);

    await saleOf(f, ids[1], 1);
    expect(await invoiceNumbers(f.businessId)).toEqual(expectedNumbers(1));
  });

  it("concurrent sales with one rejected keep invoice numbers unique", async () => {
    const f = await fixture("inv-mixed");
    const ids = await productsWithStock(f, 5);

    const results = await Promise.allSettled([
      ...ids.slice(0, 4).map((id) => saleOf(f, id, 2)),
      saleOf(f, ids[4], 2, { paidNow: 1000 }),
    ]);

    expect(results.slice(0, 4).every((r) => r.status === "fulfilled")).toBe(true);
    expect(results[4].status).toBe("rejected");
    expect(await invoiceNumbers(f.businessId)).toEqual(expectedNumbers(4));
    expect(await prisma.sale.count({ where: { businessId: f.businessId } })).toBe(4);
    expect(await stockOf(f.businessId, ids[4])).toBeCloseTo(10, 3);
  });

  it("negative adjustment that would make product stock negative is rejected and writes nothing", async () => {
    const f = await fixture("adj-seq");
    await buy(f, [{ qty: 5 }]);
    const rowsBefore = await adjustmentRows(f.businessId);

    await expect(adjust(f, -6)).rejects.toThrow();
    expect(await adjustmentRows(f.businessId)).toBe(rowsBefore);
    expect(await stockOf(f.businessId, f.productId)).toBeCloseTo(5, 3);

    await adjust(f, -5);
    expect(await stockOf(f.businessId, f.productId)).toBeCloseTo(0, 3);
    await adjust(f, 3);
    expect(await stockOf(f.businessId, f.productId)).toBeCloseTo(3, 3);
  });

  it("concurrent sale and negative adjustment never oversell", async () => {
    const f = await fixture("adj-race");
    await buy(f, [{ qty: 10 }]);

    const results = await Promise.allSettled([sell(f, [{ qty: 5 }]), adjust(f, -8)]);

    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    const stock = await stockOf(f.businessId, f.productId);
    expect(stock).toBeCloseTo(results[0].status === "fulfilled" ? 5 : 2, 3);
    expect(stock).toBeGreaterThanOrEqual(0);
  });

  it("product-level adjustment counts against variant sales through the product total", async () => {
    const f = await fixture("adj-variant");
    await buy(f, [{ qty: 6, variantId: f.variantId }]);
    await adjust(f, -4);

    await expect(sell(f, [{ qty: 3, variantId: f.variantId }])).rejects.toThrow();
    await sell(f, [{ qty: 2, variantId: f.variantId }]);

    expect(await stockOf(f.businessId, f.productId)).toBeCloseTo(0, 3);
    expect(await stockOf(f.businessId, f.productId, f.variantId)).toBeCloseTo(4, 3);
  });

  it("adjustment ignores other businesses' stock and rejects foreign products", async () => {
    const f = await fixture("adj-tenant");
    await prisma.inventoryTransaction.create({
      data: {
        businessId: f.otherBusinessId,
        productId: f.otherProductId,
        unit: "kg",
        type: "ADJUSTMENT",
        qty: 100,
        referenceType: "ADJUSTMENT",
        referenceId: "SEED",
        date: new Date("2026-10-01"),
      },
    });

    await expect(adjust(f, -1)).rejects.toThrow();
    await expect(adjust(f, -1, f.otherProductId)).rejects.toThrow("Product not found");
    expect(await stockOf(f.otherBusinessId, f.otherProductId)).toBeCloseTo(100, 3);
  });
});
