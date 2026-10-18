import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AuditService } from "../src/common/audit/audit.service";
import { ConfigService } from "../src/config/config.service";
import { CreatePurchaseDto } from "../src/purchases/dto/create-purchase.dto";
import { PrismaService } from "../src/prisma/prisma.service";
import { PurchasesService } from "../src/purchases/purchases.service";

/**
 * Purchase deletion ledger integrity (real PostgreSQL).
 *
 * Runs ONLY against the dedicated disposable database below. It is skipped
 * unless PURCHASE_DEL_TEST_DATABASE_URL points at 127.0.0.1 or localhost,
 * port 55434, database "tijaratt_purchase_del_test". It never reads the
 * production DATABASE_URL or DIRECT_URL from the environment or .env files.
 */
const SAFE_DB_NAME = "tijaratt_purchase_del_test";
const SAFE_PORT = "55434";
const testDbUrl = process.env.PURCHASE_DEL_TEST_DATABASE_URL ?? "";

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

const FAIL_FN = "tijaratt_test_fail_reversal";

describeIfSafe("Purchase deletion ledger (e2e, disposable local DB)", () => {
  let prisma: PrismaService;
  let service: PurchasesService;

  const fixture = async (label: string) => {
    const run = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const business = await prisma.business.create({
      data: { name: `PD ${run}`, slug: `pd-${run}` },
    });
    const supplier = await prisma.supplier.create({
      data: { businessId: business.id, name: "Supplier", mill: "Mill", phone: "0300" },
    });
    const product = await prisma.product.create({
      data: { businessId: business.id, name: "Steel", unit: "kg" },
    });
    return {
      businessId: business.id,
      supplierId: supplier.id,
      productId: product.id,
    };
  };

  const buy = (
    f: { businessId: string; supplierId: string; productId: string },
    lines: Array<{ qty: number; rate: number }>,
    paid = 0,
  ) =>
    service.create(
      f.businessId,
      {
        date: "2026-10-01",
        supplierId: f.supplierId,
        paid,
        lines: lines.map((line) => ({
          productId: f.productId,
          item: "Steel",
          qty: line.qty,
          unit: "kg",
          rate: line.rate,
        })),
      } as unknown as CreatePurchaseDto,
    );

  const stockOf = async (businessId: string, productId: string) => {
    const rows = await prisma.inventoryTransaction.findMany({
      where: { businessId, productId },
      select: { qty: true },
    });
    return rows.reduce((acc, r) => acc + Number(r.qty), 0).toFixed(3);
  };

  const originalsOf = (businessId: string, purchaseId: string) =>
    prisma.inventoryTransaction.findMany({
      where: { businessId, referenceType: "PURCHASE", referenceId: purchaseId },
      orderBy: { id: "asc" },
    });

  const reversalsOf = (businessId: string, purchaseId: string) =>
    prisma.inventoryTransaction.findMany({
      where: { businessId, referenceType: "PURCHASE_DELETE", referenceId: purchaseId },
      orderBy: { id: "asc" },
    });

  const deletedAuditCount = (businessId: string, purchaseId: string) =>
    prisma.auditLog.count({
      where: { businessId, entityId: purchaseId, action: "purchase.deleted" },
    });

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
    service = new PurchasesService(prisma, new AuditService(prisma));
  }, 60000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  }, 30000);

  describe("successful deletion", () => {
    it("keeps original PURCHASE rows, writes one reversal per row, and nets stock to zero", async () => {
      const f = await fixture("ok");
      const purchase = await buy(f, [
        { qty: 10.7, rate: 100 },
        { qty: 4.25, rate: 100 },
      ]);
      expect(await stockOf(f.businessId, f.productId)).toBe("14.950");
      const originalIds = (await originalsOf(f.businessId, purchase.id)).map((r) => r.id);
      expect(originalIds).toHaveLength(2);

      const result = await service.remove(f.businessId, purchase.id, "actor-1");
      expect(result).toEqual({ deleted: true, purchaseId: purchase.id });

      // Purchase document is gone.
      expect(await prisma.purchase.findUnique({ where: { id: purchase.id } })).toBeNull();

      // Original PURCHASE rows are still there, unchanged in qty.
      const originals = await originalsOf(f.businessId, purchase.id);
      expect(originals.map((r) => r.id).sort()).toEqual([...originalIds].sort());
      expect(originals.map((r) => Number(r.qty)).sort((a, b) => a - b)).toEqual([4.25, 10.7]);

      // Exactly one PURCHASE_DELETE reversal per original, opposite sign.
      const reversals = await reversalsOf(f.businessId, purchase.id);
      expect(reversals).toHaveLength(2);
      expect(reversals.map((r) => Number(r.qty)).sort((a, b) => a - b)).toEqual([-10.7, -4.25]);
      for (const rev of reversals) {
        expect(rev.productId).toBe(f.productId);
        expect(rev.type).toBe("ADJUSTMENT");
      }

      // Stock nets to zero and the audit entry is written once.
      expect(await stockOf(f.businessId, f.productId)).toBe("0.000");
      expect(await deletedAuditCount(f.businessId, purchase.id)).toBe(1);
    });
  });

  describe("rejections", () => {
    it("rejects a purchase that has supplier payments and changes nothing", async () => {
      const f = await fixture("paid");
      const purchase = await buy(f, [{ qty: 10, rate: 100 }], 500);

      await expect(service.remove(f.businessId, purchase.id)).rejects.toThrow(
        BadRequestException,
      );

      expect(await prisma.purchase.findUnique({ where: { id: purchase.id } })).not.toBeNull();
      expect(await reversalsOf(f.businessId, purchase.id)).toHaveLength(0);
      expect(await stockOf(f.businessId, f.productId)).toBe("10.000");
    });
  });

  describe("duplicate deletion", () => {
    it("allows only one of two concurrent deletes and writes no extra reversals", async () => {
      const f = await fixture("dup");
      const purchase = await buy(f, [
        { qty: 10.7, rate: 100 },
        { qty: 4.25, rate: 100 },
      ]);

      const results = await Promise.allSettled([
        service.remove(f.businessId, purchase.id),
        service.remove(f.businessId, purchase.id),
      ]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(NotFoundException);

      expect(await reversalsOf(f.businessId, purchase.id)).toHaveLength(2);
      expect(await stockOf(f.businessId, f.productId)).toBe("0.000");
      expect(await deletedAuditCount(f.businessId, purchase.id)).toBe(1);

      // A later retry is also rejected and adds nothing.
      await expect(service.remove(f.businessId, purchase.id)).rejects.toThrow(NotFoundException);
      expect(await reversalsOf(f.businessId, purchase.id)).toHaveLength(2);
      expect(await stockOf(f.businessId, f.productId)).toBe("0.000");
    });
  });

  describe("transaction rollback", () => {
    beforeAll(async () => {
      // Real DB failure: any reversal insert raises, inside the same tx.
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION ${FAIL_FN}() RETURNS trigger AS $$
        BEGIN
          IF NEW."referenceType" = 'PURCHASE_DELETE' THEN
            RAISE EXCEPTION 'forced reversal failure for test';
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

    it("leaves purchase, PURCHASE rows, stock and audit unchanged when the reversal insert fails", async () => {
      const f = await fixture("rollback");
      const purchase = await buy(f, [
        { qty: 10.7, rate: 100 },
        { qty: 4.25, rate: 100 },
      ]);
      const before = (await originalsOf(f.businessId, purchase.id)).map((r) => ({
        id: r.id,
        qty: r.qty.toString(),
        purchaseLineId: r.purchaseLineId,
      }));
      const stockBefore = await stockOf(f.businessId, f.productId);
      const auditBefore = await deletedAuditCount(f.businessId, purchase.id);

      await expect(service.remove(f.businessId, purchase.id)).rejects.toThrow();

      expect(await prisma.purchase.findUnique({ where: { id: purchase.id } })).not.toBeNull();
      expect(await prisma.purchaseLine.count({ where: { purchaseId: purchase.id } })).toBe(2);
      const after = (await originalsOf(f.businessId, purchase.id)).map((r) => ({
        id: r.id,
        qty: r.qty.toString(),
        purchaseLineId: r.purchaseLineId,
      }));
      expect(after).toEqual(before);
      expect(await reversalsOf(f.businessId, purchase.id)).toHaveLength(0);
      expect(await stockOf(f.businessId, f.productId)).toBe(stockBefore);
      expect(await deletedAuditCount(f.businessId, purchase.id)).toBe(auditBefore);
      expect(auditBefore).toBe(0);
    });
  });

  describe("cross-tenant", () => {
    it("does not let another business delete the purchase", async () => {
      const owner = await fixture("owner");
      const intruder = await fixture("intruder");
      const purchase = await buy(owner, [{ qty: 10.7, rate: 100 }]);

      await expect(service.remove(intruder.businessId, purchase.id)).rejects.toThrow(
        NotFoundException,
      );

      expect(await prisma.purchase.findUnique({ where: { id: purchase.id } })).not.toBeNull();
      expect(await reversalsOf(owner.businessId, purchase.id)).toHaveLength(0);
      expect(await stockOf(owner.businessId, owner.productId)).toBe("10.700");
      expect(await deletedAuditCount(owner.businessId, purchase.id)).toBe(0);
    });
  });
});
