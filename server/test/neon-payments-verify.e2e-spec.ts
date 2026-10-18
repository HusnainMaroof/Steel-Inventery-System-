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
 * DB-backed payment verification against the configured database (.env).
 *
 * Safety rules for this spec:
 * - Creates ONLY a uniquely named test business, users, and master data.
 * - Never edits, deletes, or truncates existing rows.
 * - Never cleans up: test records are left in place and their IDs are logged.
 * - Never prints DATABASE_URL or any credential.
 * - Runs only with NEON_VERIFY=1, so a default `npx jest` writes nothing.
 */
const run = `${Date.now()}-${randomBytes(3).toString("hex")}`;

const describeIfEnabled =
  process.env.NEON_VERIFY === "1" ? describe : describe.skip;

describeIfEnabled("Neon payment verification (settlement and balances)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let token: string;
  let otherToken: string;
  let businessId: string;
  let supplierId: string;
  let customerId: string;
  let cementId: string;
  let purchaseId: string;
  let saleAId: string;
  let saleBId: string;

  const password = randomBytes(12).toString("hex");
  const email = `verify-pay-owner-${run}@example.test`;
  const otherEmail = `verify-pay-other-${run}@example.test`;

  const auth = (t: string) => ({ authorization: `Bearer ${t}` });

  const createSale = async (qty: number, rate: number, date: string) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sales",
      headers: auth(token),
      payload: {
        date,
        customerId,
        lines: [{ productId: cementId, item: "Cement", qty, unit: "bag", rate }],
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().sale.id as string;
  };

  const pay = (payload: Record<string, unknown>, t = token) =>
    app.inject({ method: "POST", url: "/api/v1/payments", headers: auth(t), payload });

  const invoiceOf = (sId: string) =>
    prisma.invoice.findFirstOrThrow({ where: { businessId, saleId: sId } });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication(new FastifyAdapter());
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);

    const business = await prisma.business.create({
      data: { name: `Pay Verify ${run}`, slug: `pay-verify-${run}` },
    });
    businessId = business.id;
    await prisma.user.create({
      data: {
        email,
        passwordHash: hashSync(password, 10),
        name: "Pay Verify Owner",
        role: "ADMIN",
        businessId,
      },
    });

    const other = await prisma.business.create({
      data: { name: `Pay Verify Other ${run}`, slug: `pay-verify-other-${run}` },
    });
    await prisma.user.create({
      data: {
        email: otherEmail,
        passwordHash: hashSync(password, 10),
        name: "Pay Verify Other",
        role: "ADMIN",
        businessId: other.id,
      },
    });

    supplierId = (
      await prisma.supplier.create({
        data: { businessId, name: `PSupplier ${run}`, mill: "Pay Mill", phone: "0300" },
      })
    ).id;
    customerId = (
      await prisma.customer.create({
        data: { businessId, name: `PCustomer ${run}`, shop: "Pay Shop", phone: "0301" },
      })
    ).id;
    cementId = (
      await prisma.product.create({
        data: { businessId, name: `Cement ${run}`, unit: "bag" },
      })
    ).id;

    console.log(`[verify-pay] tenant=${businessId} supplier=${supplierId} customer=${customerId}`);
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
  }, 30000);

  it("logs in the test owner through the real auth endpoint", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    token = res.json().access_token as string;

    const other = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: otherEmail, password },
    });
    expect(other.statusCode).toBe(200);
    otherToken = other.json().access_token as string;
  });

  it("creates a 10 bag cement purchase (goods 10000.00) for supplier payments", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/purchases",
      headers: auth(token),
      payload: {
        date: "2026-10-01",
        supplierId,
        lines: [{ productId: cementId, item: "Cement", qty: 1000, unit: "bag", rate: 10 }],
      },
    });
    expect(res.statusCode).toBe(201);
    purchaseId = (res.json().id ?? res.json().data?.id) as string;
    const p = await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } });
    expect(p.paid.toFixed(2)).toBe("0.00");
  });

  it("partial customer payment against one invoice updates only that invoice", async () => {
    saleAId = await createSale(10, 10, "2026-10-02"); // total 100.00
    const inv = await invoiceOf(saleAId);
    expect(inv.total.toFixed(2)).toBe("100.00");

    const res = await pay({
      type: "CUSTOMER",
      date: "2026-10-03",
      customerId,
      saleId: saleAId,
      amount: 40.1,
    });
    expect(res.statusCode).toBe(201);

    const after = await invoiceOf(saleAId);
    expect(after.paid.toFixed(2)).toBe("40.10");
    const alloc = await prisma.paymentAllocation.findMany({
      where: { businessId, saleId: saleAId },
    });
    expect(alloc.reduce((s, a) => s.plus(a.amount), new Prisma.Decimal(0)).toFixed(2)).toBe("40.10");
  });

  it("rejects an overpayment against an invoice and writes nothing", async () => {
    const paymentsBefore = await prisma.payment.count({ where: { businessId } });
    const res = await pay({
      type: "CUSTOMER",
      date: "2026-10-03",
      customerId,
      saleId: saleAId,
      amount: 60.01, // remaining due is 59.90
    });
    expect(res.statusCode).toBe(400);
    expect(await prisma.payment.count({ where: { businessId } })).toBe(paymentsBefore);
    expect((await invoiceOf(saleAId)).paid.toFixed(2)).toBe("40.10");
  });

  it("untargeted customer payment settles oldest invoice first (FIFO), with allocations", async () => {
    saleBId = await createSale(5, 10, "2026-10-04"); // total 50.00, newer than sale A
    // Open dues: A = 59.90 (older), B = 50.00. Pay 70.00.
    const res = await pay({
      type: "CUSTOMER",
      date: "2026-10-05",
      customerId,
      amount: 70,
    });
    expect(res.statusCode).toBe(201);

    expect((await invoiceOf(saleAId)).paid.toFixed(2)).toBe("100.00");
    expect((await invoiceOf(saleBId)).paid.toFixed(2)).toBe("10.10");
  });

  it("rejects an untargeted customer payment larger than all open dues, writing nothing", async () => {
    const paymentsBefore = await prisma.payment.count({ where: { businessId } });
    const res = await pay({
      type: "CUSTOMER",
      date: "2026-10-05",
      customerId,
      amount: 1000,
    });
    expect(res.statusCode).toBe(400);
    expect(await prisma.payment.count({ where: { businessId } })).toBe(paymentsBefore);
  });

  it("rejects a payment with more than 2 decimal places", async () => {
    const res = await pay({
      type: "CUSTOMER",
      date: "2026-10-05",
      customerId,
      amount: 1.005,
    });
    expect(res.statusCode).toBe(400);
  });

  it("partial supplier payment against one purchase updates its paid column", async () => {
    const res = await pay({
      type: "SUPPLIER",
      date: "2026-10-06",
      supplierId,
      purchaseId,
      amount: 4000,
    });
    expect(res.statusCode).toBe(201);
    const p = await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } });
    expect(p.paid.toFixed(2)).toBe("4000.00");
  });

  it("rejects a supplier payment above the purchase goods due (goods 10000 - paid 4000)", async () => {
    const res = await pay({
      type: "SUPPLIER",
      date: "2026-10-06",
      supplierId,
      purchaseId,
      amount: 6000.01,
    });
    expect(res.statusCode).toBe(400);
    const p = await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } });
    expect(p.paid.toFixed(2)).toBe("4000.00");
  });

  it("parallel duplicate payments for the exact due: exactly one succeeds", async () => {
    // saleB has 39.90 due left after the FIFO payment (50.00 - 10.10).
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        pay({ type: "CUSTOMER", date: "2026-10-07", customerId, saleId: saleBId, amount: 39.9 }),
      ),
    );
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes.filter((c) => c === 201).length).toBe(1);
    expect(codes.filter((c) => c === 400).length).toBe(3);
    expect((await invoiceOf(saleBId)).paid.toFixed(2)).toBe("50.00");
  });

  it("reconciles invoice paid with the sum of its payment allocations", async () => {
    for (const sId of [saleAId, saleBId]) {
      const inv = await invoiceOf(sId);
      const allocs = await prisma.paymentAllocation.findMany({
        where: { businessId, saleId: sId },
      });
      const sum = allocs.reduce((s, a) => s.plus(a.amount), new Prisma.Decimal(0));
      expect(sum.toFixed(2)).toBe(inv.paid.toFixed(2));
    }
  });

  it("hides this tenant's customer from another tenant's token", async () => {
    const res = await pay(
      { type: "CUSTOMER", date: "2026-10-08", customerId, saleId: saleAId, amount: 1 },
      otherToken,
    );
    expect([400, 403, 404]).toContain(res.statusCode);
    expect((await invoiceOf(saleAId)).paid.toFixed(2)).toBe("100.00");
  });
});
