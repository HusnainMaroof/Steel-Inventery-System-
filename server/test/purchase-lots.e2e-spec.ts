import { AuditService } from "../src/common/audit/audit.service";
import { ConfigService } from "../src/config/config.service";
import { CreatePurchaseDto } from "../src/purchases/dto/create-purchase.dto";
import { PrismaService } from "../src/prisma/prisma.service";
import { PurchasesService } from "../src/purchases/purchases.service";

/**
 * Purchase lot creation checks (real PostgreSQL, service layer).
 *
 * Runs ONLY against the disposable scratch database. It is skipped unless
 * STOCK_LOT_TEST_DATABASE_URL points at 127.0.0.1 or localhost, port 55435,
 * database "tijaratt_stock_lot_scratch". It never reads DATABASE_URL or
 * DIRECT_URL from the environment or .env files.
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

describeIfSafe("purchase lots (e2e, disposable local DB)", () => {
  let prisma: PrismaService;
  let service: PurchasesService;

  const fixture = async (label: string) => {
    const run = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const business = await prisma.business.create({
      data: { name: `PL ${run}`, slug: `pl-${run}` },
    });
    const other = await prisma.business.create({
      data: { name: `PL other ${run}`, slug: `pl-other-${run}` },
    });
    const supplier = await prisma.supplier.create({
      data: { businessId: business.id, name: "Supplier", mill: "Mill", phone: "0300" },
    });
    const product = await prisma.product.create({
      data: { businessId: business.id, name: "Rod", unit: "kg" },
    });
    const otherSupplier = await prisma.supplier.create({
      data: { businessId: other.id, name: "Other", mill: "Mill", phone: "0301" },
    });
    const otherProduct = await prisma.product.create({
      data: { businessId: other.id, name: "Rod", unit: "kg" },
    });
    return {
      businessId: business.id,
      otherBusinessId: other.id,
      supplierId: supplier.id,
      productId: product.id,
      otherSupplierId: otherSupplier.id,
      otherProductId: otherProduct.id,
    };
  };

  const buy = (
    businessId: string,
    supplierId: string,
    lines: Array<{ productId: string; qty: number; rate: number }>,
  ) =>
    service.create(
      businessId,
      {
        date: "2026-10-01",
        supplierId,
        paid: 0,
        lines: lines.map((line) => ({
          productId: line.productId,
          item: "Rod",
          qty: line.qty,
          unit: "kg",
          rate: line.rate,
        })),
      } as unknown as CreatePurchaseDto,
    );

  const lotsOf = (purchaseId: string) =>
    prisma.stockLot.findMany({
      where: { purchaseId },
      orderBy: { id: "asc" },
    });

  beforeAll(async () => {
    process.env.DATABASE_URL = testDbUrl;
    process.env.DIRECT_URL = testDbUrl;

    prisma = new PrismaService(new ConfigService());
    await prisma.$connect();

    const [{ name }] = await prisma.$queryRaw<{ name: string }[]>`
      SELECT current_database()::text AS name`;
    if (name !== SAFE_DB_NAME) {
      throw new Error(`Refusing to run: connected to database "${name}"`);
    }
    service = new PurchasesService(prisma, new AuditService(prisma));
  }, 60000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it("one line: one ACTIVE lot with exact 3-decimal qty, linked to its ledger row", async () => {
    const f = await fixture("one");
    const purchase = await buy(f.businessId, f.supplierId, [
      { productId: f.productId, qty: 10.7, rate: 50 },
    ]);
    const lots = await lotsOf(purchase.id);
    expect(lots).toHaveLength(1);
    expect(lots[0].status).toBe("ACTIVE");
    expect(lots[0].receivedQty.toFixed(3)).toBe("10.700");
    expect(lots[0].purchaseLineId).toBe(purchase.lines[0].id);
    expect(lots[0].businessId).toBe(f.businessId);

    const ledger = await prisma.inventoryTransaction.findMany({
      where: { referenceId: purchase.id, businessId: f.businessId },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].lotId).toBe(lots[0].id);
    expect(ledger[0].qty.toFixed(3)).toBe("10.700");
  });

  it("three lines: three distinct lots, each linked to its own line and ledger row", async () => {
    const f = await fixture("three");
    const purchase = await buy(f.businessId, f.supplierId, [
      { productId: f.productId, qty: 1, rate: 10 },
      { productId: f.productId, qty: 2.5, rate: 10 },
      { productId: f.productId, qty: 3.125, rate: 10 },
    ]);
    const lots = await lotsOf(purchase.id);
    expect(lots).toHaveLength(3);
    expect(new Set(lots.map((l) => l.id)).size).toBe(3);
    const lineIds = purchase.lines.map((l) => l.id).sort();
    expect(lots.map((l) => l.purchaseLineId).sort()).toEqual(lineIds);

    const ledger = await prisma.inventoryTransaction.findMany({
      where: { referenceId: purchase.id, businessId: f.businessId },
    });
    expect(ledger).toHaveLength(3);
    for (const row of ledger) {
      const lot = lots.find((l) => l.id === row.lotId);
      expect(lot).toBeDefined();
      expect(lot!.receivedQty.toFixed(3)).toBe(row.qty.toFixed(3));
    }
  });

  it("five lines with 3-decimal qty: lot totals equal the entered quantities exactly", async () => {
    const f = await fixture("multi");
    const qtys = [0.125, 1, 2.5, 7.375, 10.7];
    const purchase = await buy(
      f.businessId,
      f.supplierId,
      qtys.map((qty) => ({ productId: f.productId, qty, rate: 5 })),
    );
    const lots = await lotsOf(purchase.id);
    expect(lots).toHaveLength(5);
    const total = lots.reduce((acc, l) => acc + Number(l.receivedQty), 0);
    expect(total.toFixed(3)).toBe("21.700");
    expect(lots.every((l) => l.receivedQty.decimalPlaces() <= 3)).toBe(true);
  });

  it("repeated purchases create their own lots with no duplicate IDs", async () => {
    const f = await fixture("repeat");
    const first = await buy(f.businessId, f.supplierId, [
      { productId: f.productId, qty: 4, rate: 5 },
      { productId: f.productId, qty: 6, rate: 5 },
    ]);
    const second = await buy(f.businessId, f.supplierId, [
      { productId: f.productId, qty: 4, rate: 5 },
    ]);
    const all = await prisma.stockLot.findMany({
      where: { businessId: f.businessId },
    });
    expect(all).toHaveLength(3);
    expect(new Set(all.map((l) => l.id)).size).toBe(3);
    expect(await lotsOf(first.id)).toHaveLength(2);
    expect(await lotsOf(second.id)).toHaveLength(1);
  });

  it("rejects another tenant's supplier and writes no purchase or lot", async () => {
    const f = await fixture("tenant-supplier");
    await expect(
      buy(f.businessId, f.otherSupplierId, [
        { productId: f.productId, qty: 1, rate: 5 },
      ]),
    ).rejects.toThrow("Supplier not found");
    expect(
      await prisma.purchase.count({ where: { businessId: f.businessId } }),
    ).toBe(0);
    expect(await prisma.stockLot.count({ where: { businessId: f.businessId } })).toBe(0);
  });

  describe("create response matches the stored record", () => {
    const byId = <T extends { id: string }>(rows: T[]) =>
      [...rows].sort((a, b) => a.id.localeCompare(b.id));
    const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

    it("returns the same fields and Decimal strings as a DB readback", async () => {
      const f = await fixture("contract");
      const purchase = await service.create(
        f.businessId,
        {
          date: "2026-10-01",
          supplierId: f.supplierId,
          paid: 0,
          lines: [
            {
              productId: f.productId,
              item: "Rod",
              qty: 20,
              unit: "kg",
              rate: 50.5,
              productName: "Rod 12mm",
              attributeSnapshot: { size: "12mm" },
            },
            {
              productId: f.productId,
              item: "Rod",
              qty: 20.5,
              unit: "kg",
              rate: 10,
              sellRate: 12,
              spec: "Grade 60",
              quality: "A",
            },
          ],
        } as unknown as CreatePurchaseDto,
      );

      const stored = await prisma.purchase.findUniqueOrThrow({
        where: { id: purchase.id },
        include: { lines: true },
      });
      expect(plain({ ...purchase, lines: byId(purchase.lines) })).toEqual(
        plain({ ...stored, lines: byId(stored.lines) }),
      );

      const [first, second] = purchase.lines;
      expect(first.qty).toBe("20");
      expect(first.rate).toBe("50.5");
      expect(first.sellRate).toBeNull();
      expect(second.qty).toBe("20.5");
      expect(second.rate).toBe("10");
      expect(second.sellRate).toBe("12");

      const lots = await lotsOf(purchase.id);
      expect(lots.map((l) => l.purchaseLineId).sort()).toEqual(
        purchase.lines.map((l) => l.id).sort(),
      );
      const ledger = await prisma.inventoryTransaction.findMany({
        where: { referenceId: purchase.id, businessId: f.businessId },
      });
      expect(ledger).toHaveLength(2);
      for (const row of ledger) {
        expect(row.lotId).not.toBeNull();
        const line = purchase.lines.find((l) => l.id === row.purchaseLineId);
        expect(line).toBeDefined();
        expect(row.qty.toString()).toBe(line!.qty);
      }
    });
  });

  describe("create rollback when a ledger insert fails", () => {
    const FAIL_FN = "pl_fail_purchase_create";

    beforeAll(async () => {
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION ${FAIL_FN}() RETURNS trigger AS $$
        BEGIN
          IF NEW."referenceType" = 'PURCHASE' THEN
            RAISE EXCEPTION 'forced ledger failure for test';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql`);
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER ${FAIL_FN} BEFORE INSERT ON "InventoryTransaction"
         FOR EACH ROW EXECUTE FUNCTION ${FAIL_FN}()`,
      );
    });

    afterAll(async () => {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS ${FAIL_FN} ON "InventoryTransaction"`,
      );
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${FAIL_FN}()`);
    });

    it("writes no purchase, lines, lots, ledger rows or payment", async () => {
      const f = await fixture("create-rollback");
      await expect(
        service.create(
          f.businessId,
          {
            date: "2026-10-01",
            supplierId: f.supplierId,
            paid: 5,
            lines: [
              { productId: f.productId, item: "Rod", qty: 20, unit: "kg", rate: 50 },
              { productId: f.productId, item: "Rod", qty: 4, unit: "kg", rate: 50 },
            ],
          } as unknown as CreatePurchaseDto,
        ),
      ).rejects.toThrow("forced ledger failure");

      expect(await prisma.purchase.count({ where: { businessId: f.businessId } })).toBe(0);
      expect(
        await prisma.purchaseLine.count({ where: { purchase: { businessId: f.businessId } } }),
      ).toBe(0);
      expect(await prisma.stockLot.count({ where: { businessId: f.businessId } })).toBe(0);
      expect(
        await prisma.inventoryTransaction.count({ where: { businessId: f.businessId } }),
      ).toBe(0);
      expect(await prisma.payment.count({ where: { businessId: f.businessId } })).toBe(0);
    });
  });

  it("rejects another tenant's product and writes no purchase or lot", async () => {
    const f = await fixture("tenant-product");
    await expect(
      buy(f.businessId, f.supplierId, [
        { productId: f.otherProductId, qty: 1, rate: 5 },
      ]),
    ).rejects.toThrow("One or more products were not found");
    expect(
      await prisma.purchase.count({ where: { businessId: f.businessId } }),
    ).toBe(0);
    expect(await prisma.stockLot.count({ where: { businessId: f.businessId } })).toBe(0);
  });
});
