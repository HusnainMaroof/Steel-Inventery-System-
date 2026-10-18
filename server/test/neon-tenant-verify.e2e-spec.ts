import "dotenv/config";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
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
 * DB-backed verification against the configured database (.env).
 *
 * Safety rules for this spec:
 * - Creates ONLY a uniquely named test business, users, and master data.
 * - Never edits, deletes, or truncates existing rows.
 * - Never cleans up: test records are left in place and their IDs are logged.
 * - Never prints DATABASE_URL or any credential.
 * - Runs only with NEON_VERIFY=1, so a default `npx jest` writes nothing.
 */
const run = `${Date.now()}-${randomBytes(3).toString("hex")}`;

// Writes test tenants to the configured DB, so it runs only when explicitly enabled.
const describeIfEnabled =
  process.env.NEON_VERIFY === "1" ? describe : describe.skip;

describeIfEnabled("Neon tenant verification (sales and inventory)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let token: string;
  let otherToken: string;
  let businessId: string;
  let otherBusinessId: string;
  let supplierId: string;
  let customerId: string;
  let steelId: string;
  let rebarId: string;
  let purchaseId: string;
  let saleId: string;
  let lotAId: string;
  let lotBId: string;
  let sale1Id: string;
  let sale2Id: string;

  const password = randomBytes(12).toString("hex");
  const email = `verify-owner-${run}@example.test`;
  const otherEmail = `verify-other-${run}@example.test`;

  const auth = (t: string) => ({ authorization: `Bearer ${t}` });

  const stockOf = async (productId: string): Promise<string> => {
    const rows = await prisma.inventoryTransaction.findMany({
      where: { businessId, productId },
      select: { qty: true },
    });
    return rows
      .reduce((acc, r) => acc.plus(r.qty), new Prisma.Decimal(0))
      .toString();
  };

  beforeAll(async () => {
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
      data: { name: `Verify ${run}`, slug: `verify-${run}` },
    });
    businessId = business.id;
    await prisma.user.create({
      data: {
        email,
        passwordHash: hashSync(password, 10),
        name: "Verify Owner",
        role: "ADMIN",
        businessId,
      },
    });

    const other = await prisma.business.create({
      data: { name: `Verify Other ${run}`, slug: `verify-other-${run}` },
    });
    otherBusinessId = other.id;
    await prisma.user.create({
      data: {
        email: otherEmail,
        passwordHash: hashSync(password, 10),
        name: "Verify Other",
        role: "ADMIN",
        businessId: otherBusinessId,
      },
    });

    const supplier = await prisma.supplier.create({
      data: { businessId, name: `Supplier ${run}`, mill: "Verify Mill", phone: "0300" },
    });
    supplierId = supplier.id;
    const customer = await prisma.customer.create({
      data: { businessId, name: `Customer ${run}`, shop: "Verify Shop", phone: "0301" },
    });
    customerId = customer.id;
    steelId = (await prisma.product.create({
      data: { businessId, name: `Steel ${run}`, unit: "kg" },
    })).id;
    rebarId = (await prisma.product.create({
      data: { businessId, name: `Rebar ${run}`, unit: "kg" },
    })).id;

    console.log(
      `[verify] tenant=${businessId} otherTenant=${otherBusinessId} supplier=${supplierId} customer=${customerId} steel=${steelId} rebar=${rebarId}`,
    );
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
  }, 30000);

  it("logs in both test owners through the real auth endpoint", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    token = res.json().access_token as string;
    expect(token).toBeTruthy();

    const other = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: otherEmail, password },
    });
    expect(other.statusCode).toBe(200);
    otherToken = other.json().access_token as string;
  });

  it("creates a purchase of 10.7 kg and reads 10.7 back from the API", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/purchases",
      headers: auth(token),
      payload: {
        date: "2026-10-01",
        supplierId,
        lines: [{ productId: steelId, item: "Steel", qty: 10.7, unit: "kg", rate: 100 }],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    purchaseId = body.id ?? body.data?.id;
    expect(purchaseId).toBeTruthy();
    console.log(`[verify] purchase=${purchaseId}`);

    const read = await app.inject({
      method: "GET",
      url: `/api/v1/purchases/${purchaseId}`,
      headers: auth(token),
    });
    expect(read.statusCode).toBe(200);
    const line = (read.json().lines ?? read.json().data?.lines)[0];
    expect(Number(line.qty)).toBe(10.7);
  });

  it("persists 10.700 in the database for the purchase line", async () => {
    const line = await prisma.purchaseLine.findFirstOrThrow({
      where: { purchaseId },
    });
    expect(line.qty.toFixed(3)).toBe("10.700");
  });

  it("sells 2.5 kg and leaves 8.200 in stock", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sales",
      headers: auth(token),
      payload: {
        date: "2026-10-02",
        customerId,
        lines: [{ productId: steelId, item: "Steel", qty: 2.5, unit: "kg", rate: 150 }],
      },
    });
    expect(res.statusCode).toBe(201);
    saleId = res.json().sale?.id;
    expect(saleId).toBeTruthy();
    console.log(`[verify] sale=${saleId}`);

    const stock = await app.inject({
      method: "GET",
      url: "/api/v1/inventory/stock",
      headers: auth(token),
    });
    expect(stock.statusCode).toBe(200);
    const rows = stock.json().data ?? stock.json();
    const steelRow = rows.find((r: { productId: string }) => r.productId === steelId);
    expect(Number(steelRow.qty)).toBe(8.2);
    expect(await stockOf(steelId)).toBe("8.2");
  });

  it("rejects an oversale of 8.3 kg and changes no rows", async () => {
    const countBefore = await prisma.sale.count({ where: { businessId } });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sales",
      headers: auth(token),
      payload: {
        date: "2026-10-03",
        customerId,
        lines: [{ productId: steelId, item: "Steel", qty: 8.3, unit: "kg", rate: 150 }],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(await prisma.sale.count({ where: { businessId } })).toBe(countBefore);
    expect(await stockOf(steelId)).toBe("8.2");
  });

  it("keeps invoice total exact for the 2.5 kg sale (2.5 x 150 = 375.00)", async () => {
    const invoice = await prisma.invoice.findFirstOrThrow({
      where: { businessId, saleId },
    });
    expect(invoice.total.toFixed(2)).toBe("375.00");
  });

  it("hides this tenant's purchase from another tenant's API token", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/purchases/${purchaseId}`,
      headers: auth(otherToken),
    });
    expect([403, 404]).toContain(res.statusCode);
  });

  it("reverses the sale on delete and restores stock to 10.700", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/sales/${saleId}`,
      headers: auth(token),
    });
    expect([200, 204]).toContain(res.statusCode);
    expect(await stockOf(steelId)).toBe("10.7");
  });

  // ---- Rebar: two purchase lots, COGS, invoice totals, rollback, concurrency ----

  const createPurchase = async (payload: Record<string, unknown>) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/purchases",
      headers: auth(token),
      payload,
    });
    expect(res.statusCode).toBe(201);
    return (res.json().id ?? res.json().data?.id) as string;
  };

  const createSale = (payload: Record<string, unknown>) =>
    app.inject({ method: "POST", url: "/api/v1/sales", headers: auth(token), payload });

  it("records two rebar lots with exact landed charges", async () => {
    // Lot A: 4 kg x 200 = 800 goods, transport 40 => unit cost 210
    lotAId = await createPurchase({
      date: "2026-10-04",
      supplierId,
      transport: 40,
      lines: [{ productId: rebarId, item: "Rebar", qty: 4, unit: "kg", rate: 200 }],
    });
    // Lot B: 6 kg x 210 = 1260 goods, loading 60 => unit cost 220
    lotBId = await createPurchase({
      date: "2026-10-04",
      supplierId,
      loading: 60,
      lines: [{ productId: rebarId, item: "Rebar", qty: 6, unit: "kg", rate: 210 }],
    });
    const a = await prisma.purchase.findUniqueOrThrow({ where: { id: lotAId } });
    const b = await prisma.purchase.findUniqueOrThrow({ where: { id: lotBId } });
    expect(a.transport.toFixed(2)).toBe("40.00");
    expect(b.loading.toFixed(2)).toBe("60.00");
  });

  it("multi-lot sale: 4 kg from lot A + 3 kg from lot B, invoice 2100.00", async () => {
    const res = await createSale({
      date: "2026-10-05",
      customerId,
      lines: [
        { productId: rebarId, item: "Rebar", qty: 4, unit: "kg", rate: 300, purchaseId: lotAId },
        { productId: rebarId, item: "Rebar", qty: 3, unit: "kg", rate: 300, purchaseId: lotBId },
      ],
    });
    expect(res.statusCode).toBe(201);
    sale1Id = res.json().sale.id;
    const inv = await prisma.invoice.findFirstOrThrow({ where: { businessId, saleId: sale1Id } });
    expect(inv.total.toFixed(2)).toBe("2100.00");
    const lines = await prisma.saleLine.findMany({ where: { saleId: sale1Id } });
    expect(lines.map((l) => l.purchaseId).sort()).toEqual([lotAId, lotBId].sort());
  });

  it("reports COGS 1500.00 and profit 600.00 for the lot sale (exact landed unit costs)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/reports/profit?mode=month&year=2026&month=10&productId=${rebarId}`,
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    const p = res.json().profit;
    // 4 x 210 + 3 x 220 = 1500, revenue 2100, profit 600
    expect(p.salesRevenue).toBe(2100);
    expect(p.stockCost).toBe(1500);
    expect(p.profitOnSales).toBe(600);
    expect(p.netProfit).toBe(600);
  });

  it("invoice with discount 10% + tax 17% + loading 50 totals 260.60 exactly", async () => {
    // 2 x 100 = 200; discount 20 => 180; tax 30.60 => 210.60; + loading 50 => 260.60
    const res = await createSale({
      date: "2026-10-06",
      customerId,
      discountPct: 10,
      taxPct: 17,
      loadingCharges: 50,
      lines: [{ productId: rebarId, item: "Rebar", qty: 2, unit: "kg", rate: 100 }],
    });
    expect(res.statusCode).toBe(201);
    sale2Id = res.json().sale.id;
    expect(res.json().invoice.total).toBe(260.6);
    const inv = await prisma.invoice.findFirstOrThrow({ where: { businessId, saleId: sale2Id } });
    expect(inv.total.toFixed(2)).toBe("260.60");

    const read = await app.inject({
      method: "GET",
      url: `/api/v1/invoices/${inv.id}`,
      headers: auth(token),
    });
    expect(read.statusCode).toBe(200);
    expect(Number(read.json().total ?? read.json().data?.total)).toBe(260.6);
  });

  it("rolls back the whole sale when paid-now exceeds the invoice total", async () => {
    const salesBefore = await prisma.sale.count({ where: { businessId } });
    const invBefore = await prisma.invoice.count({ where: { businessId } });
    const txBefore = await prisma.inventoryTransaction.count({ where: { businessId } });
    const stockBefore = await stockOf(rebarId);

    // 1 kg x 100 = 100 total, but paid-now 500 is rejected after sale + ledger writes
    const res = await createSale({
      date: "2026-10-07",
      customerId,
      lines: [{ productId: rebarId, item: "Rebar", qty: 1, unit: "kg", rate: 100 }],
      paidNow: 500,
    });
    expect(res.statusCode).toBe(400);

    expect(await prisma.sale.count({ where: { businessId } })).toBe(salesBefore);
    expect(await prisma.invoice.count({ where: { businessId } })).toBe(invBefore);
    expect(await prisma.inventoryTransaction.count({ where: { businessId } })).toBe(txBefore);
    expect(await stockOf(rebarId)).toBe(stockBefore);
  });

  it("5 parallel 1 kg sales with 1 kg left: exactly one succeeds, no oversell", async () => {
    expect(await stockOf(rebarId)).toBe("1");
    const salesBefore = await prisma.sale.count({ where: { businessId } });

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        createSale({
          date: "2026-10-08",
          customerId,
          lines: [{ productId: rebarId, item: "Rebar", qty: 1, unit: "kg", rate: 100 }],
        }),
      ),
    );
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes.filter((c) => c === 201).length).toBe(1);
    expect(codes.filter((c) => c === 400).length).toBe(4);

    expect(await prisma.sale.count({ where: { businessId } })).toBe(salesBefore + 1);
    expect(await stockOf(rebarId)).toBe("0");
  });
});
