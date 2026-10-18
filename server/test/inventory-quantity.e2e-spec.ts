import { ValidationPipe, VersioningType } from "@nestjs/common";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { hashSync } from "bcryptjs";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * Fractional quantity regression (10.7 purchase, 2.5 sale, 8.2 left).
 *
 * Runs ONLY against a disposable local database. It is skipped unless
 * QTY_E2E_DATABASE_URL points at 127.0.0.1 or localhost and the database
 * name ends with "_test". It never reads the production DATABASE_URL.
 */
const testDbUrl = process.env.QTY_E2E_DATABASE_URL ?? "";

function isSafeLocalTestDb(url: string): boolean {
  try {
    const parsed = new URL(url);
    // E2E_ALLOW_REMOTE_SCRATCH=1 allows a scratch database on a remote test server
    // (for example the Neon test project). The database-name check still applies.
    const remote = process.env.E2E_ALLOW_REMOTE_SCRATCH === "1";
    const local = remote || ["127.0.0.1", "localhost"].includes(parsed.hostname);
    const name = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    return local && name.endsWith("_test");
  } catch {
    return false;
  }
}

const describeIfSafe =
  testDbUrl && isSafeLocalTestDb(testDbUrl) ? describe : describe.skip;

describeIfSafe("Fractional quantities (e2e, disposable local DB)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let token: string;
  let businessId: string;
  let supplierId: string;
  let customerId: string;
  let steelId: string;
  let rebarId: string;
  let steelPurchaseId: string;

  const run = Date.now();
  const password = "qty-test-password-1";
  const email = `qty-owner-${run}@example.test`;

  const stockOf = async (productId: string): Promise<string> => {
    const rows = await prisma.inventoryTransaction.findMany({
      where: { businessId, productId },
      select: { qty: true },
    });
    const sum = rows.reduce((acc, r) => acc + Number(r.qty), 0);
    return sum.toFixed(3);
  };

  const snapshotCounts = async () => ({
    sales: await prisma.sale.count({ where: { businessId } }),
    saleLines: await prisma.saleLine.count({ where: { sale: { businessId } } }),
    invoices: await prisma.invoice.count({ where: { businessId } }),
    payments: await prisma.payment.count({ where: { businessId } }),
    allocations: await prisma.paymentAllocation.count({ where: { businessId } }),
    inventoryRows: await prisma.inventoryTransaction.count({ where: { businessId } }),
    purchaseLines: await prisma.purchaseLine.count({
      where: { purchase: { businessId } },
    }),
  });

  const auth = () => ({ authorization: `Bearer ${token}` });

  beforeAll(async () => {
    process.env.DATABASE_URL = testDbUrl;
    process.env.DIRECT_URL = testDbUrl;
    process.env.JWT_SECRET ??= "qty-e2e-test-secret-value-0123456789";
    process.env.ADMIN_EMAIL ??= "platform-admin@example.test";
    process.env.ADMIN_PASSWORD ??= "platform-admin-pass";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(new FastifyAdapter());
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);

    const business = await prisma.business.create({
      data: { name: `Qty Test ${run}`, slug: `qty-test-${run}` },
    });
    businessId = business.id;

    await prisma.user.create({
      data: {
        email,
        passwordHash: hashSync(password, 10),
        name: "Qty Owner",
        role: "ADMIN",
        businessId,
      },
    });

    const supplier = await prisma.supplier.create({
      data: { businessId, name: "Test Supplier", mill: "Test Mill", phone: "0300" },
    });
    supplierId = supplier.id;

    const customer = await prisma.customer.create({
      data: { businessId, name: "Test Customer", shop: "Test Shop", phone: "0301" },
    });
    customerId = customer.id;

    const steel = await prisma.product.create({
      data: { businessId, name: "Steel", unit: "kg" },
    });
    steelId = steel.id;

    const rebar = await prisma.product.create({
      data: { businessId, name: "Rebar", unit: "kg" },
    });
    rebarId = rebar.id;
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
  }, 30000);

  it("logs in through the real auth endpoint", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    token = res.json().access_token as string;
    expect(token).toBeTruthy();
  });

  it("creates a purchase of 10.7 and returns it as 10.7", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/purchases",
      headers: auth(),
      payload: {
        date: "2026-10-01",
        supplierId,
        lines: [{ productId: steelId, item: "Steel", qty: 10.7, unit: "kg", rate: 100 }],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    steelPurchaseId = body.id ?? body.data?.id;
    const line = (body.lines ?? body.data?.lines)[0];
    expect(Number(line.qty)).toBe(10.7);
  });

  it("reads the purchase back from the API with 10.7", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/purchases/${steelPurchaseId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const line = (body.lines ?? body.data?.lines)[0];
    expect(Number(line.qty)).toBe(10.7);
  });

  it("stores 10.7 in the database and as a +10.700 ledger row", async () => {
    const line = await prisma.purchaseLine.findFirstOrThrow({
      where: { purchaseId: steelPurchaseId },
    });
    expect(line.qty.toFixed(3)).toBe("10.700");
    expect(await stockOf(steelId)).toBe("10.700");
  });

  it("keeps 10.7 after an edit and does not double the ledger", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/purchases/${steelPurchaseId}`,
      headers: auth(),
      payload: {
        lines: [{ productId: steelId, item: "Steel", qty: 10.7, unit: "kg", rate: 105 }],
      },
    });
    expect(res.statusCode).toBe(200);

    const reload = await app.inject({
      method: "GET",
      url: `/api/v1/purchases/${steelPurchaseId}`,
      headers: auth(),
    });
    const body = reload.json();
    const line = (body.lines ?? body.data?.lines)[0];
    expect(Number(line.qty)).toBe(10.7);
    expect(await stockOf(steelId)).toBe("10.700");
  });

  it("sells 2.5 and leaves exactly 8.2 in stock", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sales",
      headers: auth(),
      payload: {
        date: "2026-10-02",
        customerId,
        lines: [{ productId: steelId, item: "Steel", qty: 2.5, unit: "kg", rate: 150 }],
      },
    });
    expect(res.statusCode).toBe(201);

    const stock = await app.inject({
      method: "GET",
      url: "/api/v1/inventory/stock",
      headers: auth(),
    });
    expect(stock.statusCode).toBe(200);
    const rows = stock.json().data ?? stock.json();
    const steelRow = rows.find((r: { productId: string }) => r.productId === steelId);
    expect(Number(steelRow.qty)).toBe(8.2);
    expect(await stockOf(steelId)).toBe("8.200");
  });

  it("writes signed fractional ledger rows (+10.700 purchase, -2.500 sale)", async () => {
    const rows = await prisma.inventoryTransaction.findMany({
      where: { businessId, productId: steelId },
      orderBy: { createdAt: "asc" },
      select: { type: true, qty: true },
    });
    const sale = rows.find((r) => r.type === "SALE");
    const purchase = rows.find((r) => r.type === "PURCHASE");
    expect(purchase?.qty.toFixed(3)).toBe("10.700");
    expect(sale?.qty.toFixed(3)).toBe("-2.500");
  });

  it("rejects overselling 8.3 and changes nothing", async () => {
    const before = await snapshotCounts();
    const stockBefore = await stockOf(steelId);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sales",
      headers: auth(),
      payload: {
        date: "2026-10-03",
        customerId,
        lines: [{ productId: steelId, item: "Steel", qty: 8.3, unit: "kg", rate: 150 }],
      },
    });
    expect(res.statusCode).toBe(400);

    expect(await snapshotCounts()).toEqual(before);
    expect(await stockOf(steelId)).toBe(stockBefore);
    expect(stockBefore).toBe("8.200");
  });

  it("handles three-decimal quantity 10.375 and sells 0.125 to leave 10.250", async () => {
    const purchase = await app.inject({
      method: "POST",
      url: "/api/v1/purchases",
      headers: auth(),
      payload: {
        date: "2026-10-01",
        supplierId,
        lines: [{ productId: rebarId, item: "Rebar", qty: 10.375, unit: "kg", rate: 100 }],
      },
    });
    expect(purchase.statusCode).toBe(201);
    const pBody = purchase.json();
    const pLine = (pBody.lines ?? pBody.data?.lines)[0];
    expect(Number(pLine.qty)).toBe(10.375);

    const sale = await app.inject({
      method: "POST",
      url: "/api/v1/sales",
      headers: auth(),
      payload: {
        date: "2026-10-02",
        customerId,
        lines: [{ productId: rebarId, item: "Rebar", qty: 0.125, unit: "kg", rate: 150 }],
      },
    });
    expect(sale.statusCode).toBe(201);

    expect(await stockOf(rebarId)).toBe("10.250");
  });

  it("reconciles lines, ledger and invoice totals for fractional sales", async () => {
    const sumLines = async (productId: string) => {
      const rows = await prisma.saleLine.findMany({
        where: { productId, sale: { businessId } },
        select: { qty: true },
      });
      return rows.reduce((acc, r) => acc + Number(r.qty), 0).toFixed(3);
    };
    const sumPurchaseLines = async (productId: string) => {
      const rows = await prisma.purchaseLine.findMany({
        where: { productId, purchase: { businessId } },
        select: { qty: true },
      });
      return rows.reduce((acc, r) => acc + Number(r.qty), 0).toFixed(3);
    };

    // Steel: 10.7 bought, 2.5 sold, ledger and lines agree.
    expect(await sumPurchaseLines(steelId)).toBe("10.700");
    expect(await sumLines(steelId)).toBe("2.500");
    expect(await stockOf(steelId)).toBe("8.200");

    // Rebar: 10.375 bought, 0.125 sold.
    expect(await sumPurchaseLines(rebarId)).toBe("10.375");
    expect(await sumLines(rebarId)).toBe("0.125");
    expect(await stockOf(rebarId)).toBe("10.250");

    // Invoice totals equal qty * rate (no tax or discount on these sales).
    const steelInvoice = await prisma.invoice.findFirstOrThrow({
      where: { businessId, sale: { lines: { some: { productId: steelId } } } },
    });
    expect(steelInvoice.total.toFixed(2)).toBe("375.00");

    const rebarInvoice = await prisma.invoice.findFirstOrThrow({
      where: { businessId, sale: { lines: { some: { productId: rebarId } } } },
    });
    expect(rebarInvoice.total.toFixed(2)).toBe("18.75");
  });
});
