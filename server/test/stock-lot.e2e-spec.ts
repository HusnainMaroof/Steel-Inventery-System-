import { AuditService } from "../src/common/audit/audit.service";
import { ConfigService } from "../src/config/config.service";
import { CreatePurchaseDto } from "../src/purchases/dto/create-purchase.dto";
import { UpdatePurchaseDto } from "../src/purchases/dto/update-purchase.dto";
import { PrismaService } from "../src/prisma/prisma.service";
import { PurchasesService } from "../src/purchases/purchases.service";
import { SalesService } from "../src/sales/sales.service";
import { PaymentsService } from "../src/payments/payments.service";
import { CreateSaleDto } from "../src/sales/dto/create-sale.dto";

/**
 * StockLot schema and purchase-line reversal checks (real PostgreSQL).
 *
 * Runs ONLY against a disposable database. It is skipped unless
 * STOCK_LOT_TEST_DATABASE_URL points at 127.0.0.1 or localhost, port 55435,
 * database "tijaratt_stock_lot_scratch". It never reads DATABASE_URL or
 * DIRECT_URL from the environment or .env files.
 *
 * Lot tables are touched with raw SQL on purpose, so this file compiles
 * before the StockLot Prisma model is approved and applied.
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

describeIfSafe("StockLot schema and purchase reversals (e2e, disposable local DB)", () => {
  let prisma: PrismaService;
  let service: PurchasesService;
  let salesService: SalesService;

  const fixture = async (label: string) => {
    const run = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const business = await prisma.business.create({
      data: { name: `SL ${run}`, slug: `sl-${run}` },
    });
    const other = await prisma.business.create({
      data: { name: `SL other ${run}`, slug: `sl-other-${run}` },
    });
    const supplier = await prisma.supplier.create({
      data: { businessId: business.id, name: "Supplier", mill: "Mill", phone: "0300" },
    });
    const product = await prisma.product.create({
      data: { businessId: business.id, name: "Steel", unit: "kg" },
    });
    const otherProduct = await prisma.product.create({
      data: { businessId: other.id, name: "Steel", unit: "kg" },
    });
    return {
      businessId: business.id,
      otherBusinessId: other.id,
      supplierId: supplier.id,
      productId: product.id,
      otherProductId: otherProduct.id,
    };
  };

  const insertLot = async (businessId: string, productId: string) => {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "StockLot" (id, "businessId", "productId", unit, "receivedQty", "receivedAt")
      VALUES (gen_random_uuid()::text, ${businessId}, ${productId}, 'kg', 10::numeric, CURRENT_DATE)
      RETURNING id`;
    return rows[0].id;
  };

  const insertTx = (
    businessId: string,
    productId: string,
    qty: string,
    lotId: string | null,
    referenceType = "ADJUSTMENT",
  ) =>
    prisma.$executeRaw`
      INSERT INTO "InventoryTransaction"
        (id, "businessId", "productId", unit, type, qty, "referenceType", "referenceId", date, "lotId")
      VALUES
        (gen_random_uuid()::text, ${businessId}, ${productId}, 'kg', 'ADJUSTMENT',
         ${qty}::numeric, ${referenceType}, 'TEST', CURRENT_DATE, ${lotId})`;

  const countLots = async (businessId: string) => {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM "StockLot" WHERE "businessId" = ${businessId}`;
    return Number(rows[0].n);
  };

  const countTx = async (businessId: string, lotId?: string) => {
    const rows = lotId
      ? await prisma.$queryRaw<{ n: bigint }[]>`
          SELECT COUNT(*) AS n FROM "InventoryTransaction"
          WHERE "businessId" = ${businessId} AND "lotId" = ${lotId}`
      : await prisma.$queryRaw<{ n: bigint }[]>`
          SELECT COUNT(*) AS n FROM "InventoryTransaction" WHERE "businessId" = ${businessId}`;
    return Number(rows[0].n);
  };

  const stockOf = async (businessId: string, productId: string) => {
    const rows = await prisma.inventoryTransaction.findMany({
      where: { businessId, productId },
      select: { qty: true },
    });
    return rows.reduce((acc, r) => acc + Number(r.qty), 0).toFixed(3);
  };

  const buy = (
    f: { businessId: string; supplierId: string; productId: string },
    lines: Array<{ qty: number; rate: number }>,
  ) =>
    service.create(
      f.businessId,
      {
        date: "2026-10-01",
        supplierId: f.supplierId,
        paid: 0,
        lines: lines.map((line) => ({
          productId: f.productId,
          item: "Steel",
          qty: line.qty,
          unit: "kg",
          rate: line.rate,
        })),
      } as unknown as CreatePurchaseDto,
    );

  beforeAll(async () => {
    // Force every config path to the disposable DB. Nothing else is read.
    process.env.DATABASE_URL = testDbUrl;
    process.env.DIRECT_URL = testDbUrl;

    prisma = new PrismaService(new ConfigService());
    await prisma.$connect();

    // Second check on the live connection: refuse to run against any other DB.
    const [{ name }] = await prisma.$queryRaw<{ name: string }[]>`
      SELECT current_database()::text AS name`;
    if (name !== SAFE_DB_NAME) {
      throw new Error(`Refusing to run: connected to database "${name}"`);
    }

    const [{ reg }] = await prisma.$queryRaw<{ reg: string | null }[]>`
      SELECT to_regclass('"StockLot"')::text AS reg`;
    if (!reg) {
      throw new Error('StockLot table missing. Apply the approved draft migration first.');
    }
    service = new PurchasesService(prisma, new AuditService(prisma));
    salesService = new SalesService(prisma, new AuditService(prisma));
  }, 60000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  }, 30000);

  describe("composite foreign key (businessId, lotId)", () => {
    it("accepts a NULL lotId (legacy rows and FK skip)", async () => {
      const f = await fixture("null");
      await expect(insertTx(f.businessId, f.productId, "5", null)).resolves.toBe(1);
    });

    it("accepts a lot from the same business", async () => {
      const f = await fixture("same");
      const lotId = await insertLot(f.businessId, f.productId);
      await expect(insertTx(f.businessId, f.productId, "5", lotId)).resolves.toBe(1);
    });

    it("rejects a lot that belongs to another business (cross-tenant)", async () => {
      const f = await fixture("cross");
      const foreignLot = await insertLot(f.otherBusinessId, f.otherProductId);
      await expect(insertTx(f.businessId, f.productId, "5", foreignLot)).rejects.toThrow(
        /foreign key/i,
      );
    });

    it("rejects a lot id that does not exist", async () => {
      const f = await fixture("missing");
      await expect(
        insertTx(f.businessId, f.productId, "5", "does-not-exist"),
      ).rejects.toThrow(/foreign key/i);
    });
  });

  describe("ON DELETE RESTRICT", () => {
    it("blocks deleting a lot that ledger rows still reference", async () => {
      const f = await fixture("restrict");
      const lotId = await insertLot(f.businessId, f.productId);
      await insertTx(f.businessId, f.productId, "5", lotId);
      await expect(
        prisma.$executeRaw`DELETE FROM "StockLot" WHERE id = ${lotId}`,
      ).rejects.toThrow(/foreign key/i);
      expect(await countLots(f.businessId)).toBe(1);
    });

    it("allows deleting a lot with no ledger rows", async () => {
      const f = await fixture("restrict-free");
      const lotId = await insertLot(f.businessId, f.productId);
      await expect(
        prisma.$executeRaw`DELETE FROM "StockLot" WHERE id = ${lotId}`,
      ).resolves.toBe(1);
    });
  });

  describe("INTENTIONAL NEGATIVE: database invariants (raw SQL, not a valid app workflow)", () => {
    // Purpose: show which invalid state PostgreSQL currently PERMITS.
    // This is not an application workflow. The app never creates this state:
    // PurchasesService.remove writes reversals before it marks a lot VOIDED.
    // The VOIDED-with-stock invariant is enforced by application logic, not by a
    // PostgreSQL constraint. Documented in RECOVERY-REPORT.md.
    // Fixture rows use referenceId 'TEST' and are scoped to this test's business.
    // The whole probe runs inside a transaction that is ALWAYS rolled back, so the
    // invalid state never persists and no fixture lot is left in scratch.
    it("DB accepts a VOIDED status with positive stock (documents the missing DB constraint)", async () => {
      const f = await fixture("void");
      const observed = { status: "", ledgerRows: 0 };

      await expect(
        prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<{ id: string }[]>`
            INSERT INTO "StockLot" (id, "businessId", "productId", unit, "receivedQty", "receivedAt")
            VALUES (gen_random_uuid()::text, ${f.businessId}, ${f.productId}, 'kg', 10::numeric, CURRENT_DATE)
            RETURNING id`;
          const lotId = rows[0].id;
          await tx.$executeRaw`
            INSERT INTO "InventoryTransaction"
              (id, "businessId", "productId", unit, type, qty, "referenceType", "referenceId", date, "lotId")
            VALUES
              (gen_random_uuid()::text, ${f.businessId}, ${f.productId}, 'kg', 'ADJUSTMENT',
               7::numeric, 'ADJUSTMENT', 'TEST', CURRENT_DATE, ${lotId})`;

          // The DB must accept this: no CHECK or trigger blocks VOIDED with stock.
          await tx.$executeRaw`UPDATE "StockLot" SET status = 'VOIDED' WHERE id = ${lotId}`;

          const [{ status }] = await tx.$queryRaw<{ status: string }[]>`
            SELECT status FROM "StockLot" WHERE id = ${lotId}`;
          const [{ n }] = await tx.$queryRaw<{ n: bigint }[]>`
            SELECT COUNT(*) AS n FROM "InventoryTransaction" WHERE "lotId" = ${lotId}`;
          observed.status = status;
          observed.ledgerRows = Number(n);
          throw new Error("rollback-probe");
        }),
      ).rejects.toThrow("rollback-probe");

      expect(observed.status).toBe("VOIDED");
      expect(observed.ledgerRows).toBe(1);
      expect(await countLots(f.businessId)).toBe(0);
      expect(await countTx(f.businessId)).toBe(0);
    });
  });

  describe("transaction rollback", () => {
    it("rolls back a lot and its linked ledger row together", async () => {
      const f = await fixture("rollback");
      await expect(
        prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<{ id: string }[]>`
            INSERT INTO "StockLot" (id, "businessId", "productId", unit, "receivedQty", "receivedAt")
            VALUES (gen_random_uuid()::text, ${f.businessId}, ${f.productId}, 'kg', 3::numeric, CURRENT_DATE)
            RETURNING id`;
          await tx.$executeRaw`
            INSERT INTO "InventoryTransaction"
              (id, "businessId", "productId", unit, type, qty, "referenceType", "referenceId", date, "lotId")
            VALUES
              (gen_random_uuid()::text, ${f.businessId}, ${f.productId}, 'kg', 'ADJUSTMENT',
               3::numeric, 'ADJUSTMENT', 'TEST', CURRENT_DATE, ${rows[0].id})`;
          throw new Error("rollback-probe");
        }),
      ).rejects.toThrow("rollback-probe");

      expect(await countLots(f.businessId)).toBe(0);
      expect(await countTx(f.businessId)).toBe(0);
    });
  });

  describe("purchase line removal keeps history and stock", () => {
    it("writes a reversal for a removed line and keeps original PURCHASE rows", async () => {
      const f = await fixture("line-removal");
      const purchase = await buy(f, [
        { qty: 10.7, rate: 100 },
        { qty: 4.25, rate: 100 },
      ]);
      expect(await stockOf(f.businessId, f.productId)).toBe("14.950");

      const originalsBefore = await prisma.inventoryTransaction.count({
        where: { businessId: f.businessId, referenceType: "PURCHASE", referenceId: purchase.id },
      });
      const lines = await prisma.purchaseLine.findMany({
        where: { purchaseId: purchase.id },
        orderBy: { id: "asc" },
      });
      const keep = lines.find((l) => Number(l.qty) === 10.7)!;

      await service.update(
        f.businessId,
        purchase.id,
        {
          lines: [{ id: keep.id, productId: f.productId, item: "Steel", qty: 10.7, unit: "kg", rate: 100 }],
        } as unknown as UpdatePurchaseDto,
      );

      const originalsAfter = await prisma.inventoryTransaction.count({
        where: { businessId: f.businessId, referenceType: "PURCHASE", referenceId: purchase.id },
      });
      expect(originalsAfter).toBe(originalsBefore);

      const reversals = await prisma.inventoryTransaction.findMany({
        where: { businessId: f.businessId, referenceType: "PURCHASE_LINE_REVERSAL" },
      });
      expect(reversals).toHaveLength(1);
      expect(Number(reversals[0].qty)).toBe(-4.25);
      expect(await stockOf(f.businessId, f.productId)).toBe("10.700");
    });
  });

  describe("sale-to-lot attribution", () => {
    const customerFor = async (businessId: string) => {
      const customer = await prisma.customer.create({
        data: { businessId, name: "Buyer", shop: "Shop", phone: "0333" },
      });
      return customer.id;
    };

    const lotBalance = async (lotId: string) => {
      const rows = await prisma.inventoryTransaction.findMany({
        where: { lotId },
        select: { qty: true },
      });
      return rows.reduce((acc, r) => acc + Number(r.qty), 0).toFixed(3);
    };

    const lotOfPurchase = async (businessId: string, purchaseId: string) => {
      const lot = await prisma.stockLot.findFirst({
        where: { businessId, purchaseId },
        orderBy: { createdAt: "asc" },
      });
      if (!lot) throw new Error("fixture: purchase has no lot");
      return lot.id;
    };

    const sell = (
      f: { businessId: string; productId: string },
      customerId: string,
      lines: Array<{ qty: number; lotId?: string }>,
    ) =>
      salesService.create(f.businessId, {
        date: "2026-10-02",
        customerId,
        lines: lines.map((line) => ({
          productId: f.productId,
          item: "Steel",
          qty: line.qty,
          unit: "kg",
          rate: 100,
          lotId: line.lotId,
        })),
      } as unknown as CreateSaleDto);

    it("sells from the chosen lot and stamps lotId on the sale line and SALE row", async () => {
      const f = await fixture("sale-lot");
      const customerId = await customerFor(f.businessId);
      const purchase = await buy(f, [{ qty: 10.7, rate: 100 }]);
      const lotId = await lotOfPurchase(f.businessId, purchase.id);

      const { sale } = await sell(f, customerId, [{ qty: 2.5, lotId }]);

      expect(sale.lines[0].lotId).toBe(lotId);
      expect(sale.lines[0].purchaseId).toBe(purchase.id);
      expect(await lotBalance(lotId)).toBe("8.200");

      const saleRow = await prisma.inventoryTransaction.findFirst({
        where: { businessId: f.businessId, referenceType: "SALE", referenceId: sale.id },
      });
      expect(saleRow?.lotId).toBe(lotId);
      expect(Number(saleRow?.qty)).toBe(-2.5);
    });

    it("creates one sale for two concurrent requests with the same clientRequestId", async () => {
      const f = await fixture("sale-idem");
      const customerId = await customerFor(f.businessId);
      const purchase = await buy(f, [{ qty: 10, rate: 100 }]);
      const lotId = await lotOfPurchase(f.businessId, purchase.id);
      const dto = {
        date: "2026-10-02",
        customerId,
        clientRequestId: "3d0f6a2e-8b1c-4f5d-9a7e-2c4b6d8e0f13",
        lines: [{ productId: f.productId, item: "Steel", qty: 2, unit: "kg", rate: 100, lotId }],
      } as unknown as CreateSaleDto;

      const [a, b] = await Promise.all([
        salesService.create(f.businessId, { ...dto }),
        salesService.create(f.businessId, { ...dto }),
      ]);

      expect(a.sale.id).toBe(b.sale.id);
      expect(a.invoice.number).toBe(b.invoice.number);
      expect(await prisma.sale.count({ where: { businessId: f.businessId } })).toBe(1);
      expect(await lotBalance(lotId)).toBe("8.000");
    });

    it("returns the saved sale on a retry even when its stock is used up", async () => {
      const f = await fixture("sale-idem-retry");
      const customerId = await customerFor(f.businessId);
      const purchase = await buy(f, [{ qty: 3, rate: 100 }]);
      const lotId = await lotOfPurchase(f.businessId, purchase.id);
      const dto = {
        date: "2026-10-02",
        customerId,
        clientRequestId: "7a5b3c1d-9e8f-4a6b-8c2d-1e0f9a8b7c6d",
        lines: [{ productId: f.productId, item: "Steel", qty: 3, unit: "kg", rate: 100, lotId }],
      } as unknown as CreateSaleDto;

      const first = await salesService.create(f.businessId, { ...dto });
      const retry = await salesService.create(f.businessId, { ...dto });

      expect(retry.sale.id).toBe(first.sale.id);
      expect(await prisma.sale.count({ where: { businessId: f.businessId } })).toBe(1);
      expect(await lotBalance(lotId)).toBe("0.000");
    });

    it("rejects a line larger than its lot, even when total product stock is enough", async () => {
      const f = await fixture("sale-lot-short");
      const customerId = await customerFor(f.businessId);
      const first = await buy(f, [{ qty: 10.7, rate: 100 }]);
      await buy(f, [{ qty: 4.25, rate: 100 }]);
      const lotId = await lotOfPurchase(f.businessId, first.id);
      const salesBefore = await prisma.sale.count({ where: { businessId: f.businessId } });

      await expect(sell(f, customerId, [{ qty: 11, lotId }])).rejects.toThrow(/source lot/i);

      expect(await prisma.sale.count({ where: { businessId: f.businessId } })).toBe(salesBefore);
      expect(await lotBalance(lotId)).toBe("10.700");
    });

    it("sums two lines from the same lot before checking the balance", async () => {
      const f = await fixture("sale-lot-sum");
      const customerId = await customerFor(f.businessId);
      const purchase = await buy(f, [{ qty: 10.7, rate: 100 }]);
      const lotId = await lotOfPurchase(f.businessId, purchase.id);

      await expect(
        sell(f, customerId, [
          { qty: 6, lotId },
          { qty: 6, lotId },
        ]),
      ).rejects.toThrow(/source lot/i);
      expect(await lotBalance(lotId)).toBe("10.700");
    });

    it("voids a lot through purchase delete, then rejects sales from it", async () => {
      const f = await fixture("sale-lot-void");
      const customerId = await customerFor(f.businessId);
      const purchase = await buy(f, [{ qty: 10.7, rate: 100 }]);
      const lotId = await lotOfPurchase(f.businessId, purchase.id);

      await service.remove(f.businessId, purchase.id);

      const [{ status }] = await prisma.$queryRaw<{ status: string }[]>`
        SELECT status FROM "StockLot" WHERE id = ${lotId}`;
      expect(status).toBe("VOIDED");
      expect(await lotBalance(lotId)).toBe("0.000");
      expect(await stockOf(f.businessId, f.productId)).toBe("0.000");

      await expect(sell(f, customerId, [{ qty: 1, lotId }])).rejects.toThrow(/voided/i);
    });

    it("rejects a lot id that belongs to another business or does not exist", async () => {
      const f = await fixture("sale-lot-tenant");
      const customerId = await customerFor(f.businessId);
      const foreignLot = await insertLot(f.otherBusinessId, f.otherProductId);

      await expect(sell(f, customerId, [{ qty: 1, lotId: foreignLot }])).rejects.toThrow(
        /source lot not found/i,
      );
      await expect(
        sell(f, customerId, [{ qty: 1, lotId: "cmnotarealuuidxxxxxxxxxxxx" }]),
      ).rejects.toThrow(/source lot not found/i);
    });

    it("keeps legacy sales without lotId working with lotId NULL", async () => {
      const f = await fixture("sale-legacy");
      const customerId = await customerFor(f.businessId);
      await buy(f, [{ qty: 10.7, rate: 100 }]);

      const { sale } = await sell(f, customerId, [{ qty: 3, lotId: undefined }]);

      expect(sale.lines[0].lotId).toBeNull();
      expect(await stockOf(f.businessId, f.productId)).toBe("7.700");
    });

    it("restores the lot balance when the sale is deleted, using a lotId RETURN row", async () => {
      const f = await fixture("sale-lot-delete");
      const customerId = await customerFor(f.businessId);
      const purchase = await buy(f, [{ qty: 10.7, rate: 100 }]);
      const lotId = await lotOfPurchase(f.businessId, purchase.id);
      const { sale } = await sell(f, customerId, [{ qty: 2.5, lotId }]);
      expect(await lotBalance(lotId)).toBe("8.200");

      await salesService.remove(f.businessId, sale.id);

      expect(await lotBalance(lotId)).toBe("10.700");
      const returnRow = await prisma.inventoryTransaction.findFirst({
        where: { businessId: f.businessId, referenceType: "SALE_DELETE", referenceId: sale.id },
      });
      expect(returnRow?.lotId).toBe(lotId);
      expect(Number(returnRow?.qty)).toBe(2.5);
    });

    it("does not restore lot stock a second time on repeated sale deletion", async () => {
      const f = await fixture("sale-lot-twice");
      const customerId = await customerFor(f.businessId);
      const purchase = await buy(f, [{ qty: 10.7, rate: 100 }]);
      const lotId = await lotOfPurchase(f.businessId, purchase.id);
      const { sale } = await sell(f, customerId, [{ qty: 2.5, lotId }]);

      await salesService.remove(f.businessId, sale.id);
      await expect(salesService.remove(f.businessId, sale.id)).rejects.toThrow(/not found/i);

      expect(await lotBalance(lotId)).toBe("10.700");
      const returns = await prisma.inventoryTransaction.count({
        where: { businessId: f.businessId, referenceType: "SALE_DELETE", referenceId: sale.id },
      });
      expect(returns).toBe(1);
    });

    it("rolls back a sale delete when a later step fails", async () => {
      const f = await fixture("sale-lot-delete-rollback");
      const customerId = await customerFor(f.businessId);
      const purchase = await buy(f, [{ qty: 10.7, rate: 100 }]);
      const lotId = await lotOfPurchase(f.businessId, purchase.id);
      const { sale } = await sell(f, customerId, [{ qty: 2.5, lotId }]);

      // Injected failure in the same statement that writes the reversal rows: a trigger
      // fails the `sale.deleted` audit insert, so the whole transaction must roll back.
      const failFn = "sl_fail_sale_delete_audit";
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION ${failFn}() RETURNS trigger AS $$
        BEGIN
          IF NEW."action" = 'sale.deleted' THEN
            RAISE EXCEPTION 'injected audit failure';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql`);
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER ${failFn} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${failFn}()`,
      );
      try {
        await expect(salesService.remove(f.businessId, sale.id)).rejects.toThrow(
          "injected audit failure",
        );
      } finally {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${failFn} ON "AuditLog"`);
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${failFn}()`);
      }
      expect(await prisma.invoice.count({ where: { saleId: sale.id } })).toBe(1);

      expect(await prisma.sale.count({ where: { id: sale.id } })).toBe(1);
      expect(await lotBalance(lotId)).toBe("8.200");
      const returns = await prisma.inventoryTransaction.count({
        where: { businessId: f.businessId, referenceType: "SALE_DELETE", referenceId: sale.id },
      });
      expect(returns).toBe(0);
    });

    it("rolls back a sale create when a later step fails", async () => {
      const f = await fixture("sale-lot-create-rollback");
      const customerId = await customerFor(f.businessId);
      const purchase = await buy(f, [{ qty: 10.7, rate: 100 }]);
      const lotId = await lotOfPurchase(f.businessId, purchase.id);
      const salesBefore = await prisma.sale.count({ where: { businessId: f.businessId } });

      // Sale create writes every row, audit last, in one statement. A trigger that
      // fails the audit insert is the "later step fails" case for that statement.
      const failFn = "sl_fail_sale_create_audit";
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION ${failFn}() RETURNS trigger AS $$
        BEGIN
          IF NEW."action" = 'sale.created' THEN
            RAISE EXCEPTION 'injected audit failure';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql`);
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER ${failFn} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${failFn}()`,
      );
      try {
        await expect(sell(f, customerId, [{ qty: 2.5, lotId }])).rejects.toThrow(
          "injected audit failure",
        );
      } finally {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${failFn} ON "AuditLog"`);
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${failFn}()`);
      }

      expect(await prisma.sale.count({ where: { businessId: f.businessId } })).toBe(salesBefore);
      expect(await lotBalance(lotId)).toBe("10.700");
      expect(
        await prisma.invoice.count({ where: { businessId: f.businessId, sale: { lines: { some: { lotId } } } } }),
      ).toBe(0);
    });

    it("sale delete removes a FIFO receipt that only settled it and keeps one that also settled another sale", async () => {
      const f = await fixture("sale-delete-fifo");
      const customerId = await customerFor(f.businessId);
      const purchase = await buy(f, [{ qty: 10, rate: 50 }]);
      const lotId = await lotOfPurchase(f.businessId, purchase.id);
      const sellOn = (date: string) =>
        salesService.create(f.businessId, {
          date,
          customerId,
          lines: [{ productId: f.productId, item: "Steel", qty: 1, unit: "kg", rate: 100, lotId }],
        } as unknown as CreateSaleDto);
      // FIFO settles the oldest invoice first, so the dates fix the order.
      const { sale: older } = await sellOn("2026-10-02");
      const { sale: newer } = await sellOn("2026-10-03");
      const payments = new PaymentsService(prisma, new AuditService(prisma));
      // 60 settles only the older invoice. 80 settles its last 40 and 40 of the newer one.
      const onlyOlder = await payments.create(f.businessId, {
        date: "2026-10-04", type: "CUSTOMER", customerId, amount: 60,
      });
      const both = await payments.create(f.businessId, {
        date: "2026-10-04", type: "CUSTOMER", customerId, amount: 80,
      });

      await salesService.remove(f.businessId, older.id);

      expect(await prisma.payment.count({ where: { id: onlyOlder.id } })).toBe(0);
      const kept = await prisma.payment.findUnique({
        where: { id: both.id },
        include: { allocations: true },
      });
      expect(kept?.allocations.map((a) => [a.saleId, a.amount.toFixed(2)])).toEqual([
        [newer.id, "40.00"],
      ]);
      const newerInvoice = await prisma.invoice.findUnique({ where: { saleId: newer.id } });
      expect(newerInvoice?.paid.toFixed(2)).toBe("40.00");
      expect(await prisma.invoice.count({ where: { saleId: older.id } })).toBe(0);
      expect(await lotBalance(lotId)).toBe("9.000");
    });
  });
});
