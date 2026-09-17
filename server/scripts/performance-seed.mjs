/**
 * Seeds a performance test dataset and records timings.
 *
 * Usage:
 *   node scripts/performance-seed.mjs
 *   SCALE=1000 node scripts/performance-seed.mjs
 *   SCALE=10000 node scripts/performance-seed.mjs
 *
 * Requires: server on PORT (default 4000), DATABASE_URL, super-admin credentials.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const API = (process.env.TRADEX_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@tradex.app";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "TradexAdmin2026";
const SCALE = Math.min(
  10_000,
  Math.max(10, Number(process.env.SCALE ?? "500")),
);
const RUN_ID = Date.now().toString(36);

const prisma = new PrismaClient();
const metrics = [];

function metric(name, ms, detail = "") {
  metrics.push({ name, ms, detail });
  console.log(`  ${name}: ${ms.toFixed(0)}ms${detail ? ` (${detail})` : ""}`);
}

async function api(token, method, path, body) {
  const started = performance.now();
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const elapsed = performance.now() - started;
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!res.ok) {
    const msg = data?.message ?? res.statusText;
    throw new Error(`${method} ${path} failed: ${msg}`);
  }
  return { data, elapsed, bytes: text.length };
}

async function login(email, password) {
  const res = await api(null, "POST", "/auth/login", { email, password });
  return res.data.access_token;
}

async function ensurePerfBusiness() {
  const email = `perf-${RUN_ID}@test.local`;
  const password = "PerfTest2026!";
  const slug = `perf-${RUN_ID}`;

  const existing = await prisma.user.findFirst({
    where: { email },
    select: { id: true, businessId: true },
  });
  if (existing) {
    return { email, password, businessId: existing.businessId };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const business = await prisma.business.create({
    data: {
      name: `Perf Business ${RUN_ID}`,
      slug,
      subscriptionStatus: "ACTIVE",
    },
  });
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Perf Owner",
      role: "ADMIN",
      businessId: business.id,
    },
  });
  return { email, password, businessId: business.id };
}

async function seedViaPrisma(businessId) {
  const t0 = performance.now();
  const supplier = await prisma.supplier.create({
    data: { businessId, name: "Perf Mill", mill: "Mill", phone: "03000000001" },
  });
  const customer = await prisma.customer.create({
    data: { businessId, name: "Perf Customer", shop: "Shop", phone: "03000000002" },
  });
  const product = await prisma.product.create({
    data: { businessId, name: "Perf Product", unit: "pcs" },
  });

  const customerCount = SCALE;
  const productCount = Math.min(SCALE, 500);
  const salesCount = SCALE;
  const purchaseCount = SCALE;
  const paymentCount = Math.min(SCALE * 5, 50_000);
  const expenseCount = SCALE;

  console.log(`\nSeeding business ${businessId} (SCALE=${SCALE})...`);

  const batch = 500;
  for (let i = 0; i < customerCount; i += batch) {
    await prisma.customer.createMany({
      data: Array.from({ length: Math.min(batch, customerCount - i) }, (_, j) => ({
        businessId,
        name: `Customer ${i + j}`,
        shop: `Shop ${i + j}`,
        phone: `03${String(i + j).padStart(9, "0")}`,
      })),
      skipDuplicates: true,
    });
  }
  metric("customers seeded", performance.now() - t0, String(customerCount));

  const t1 = performance.now();
  for (let i = 0; i < productCount; i += batch) {
    await prisma.product.createMany({
      data: Array.from({ length: Math.min(batch, productCount - i) }, (_, j) => ({
        businessId,
        name: `Product ${i + j}`,
        unit: "pcs",
      })),
      skipDuplicates: true,
    });
  }
  metric("products seeded", performance.now() - t1, String(productCount));

  const t2 = performance.now();
  for (let i = 0; i < purchaseCount; i += 100) {
    const n = Math.min(100, purchaseCount - i);
    for (let j = 0; j < n; j++) {
      const purchase = await prisma.purchase.create({
        data: {
          businessId,
          supplierId: supplier.id,
          date: new Date(2025, 0, 1 + ((i + j) % 28)),
          paid: 0,
          lines: {
            create: {
              productId: product.id,
              item: "Item",
              qty: 10,
              rate: 100,
              unit: "pcs",
            },
          },
        },
      });
      await prisma.inventoryTransaction.create({
        data: {
          businessId,
          productId: product.id,
          type: "PURCHASE",
          qty: 10,
          unit: "pcs",
          referenceType: "PURCHASE",
          referenceId: purchase.id,
          date: purchase.date,
        },
      });
    }
  }
  metric("purchases seeded", performance.now() - t2, String(purchaseCount));

  const t3 = performance.now();
  for (let i = 0; i < salesCount; i += 100) {
    const n = Math.min(100, salesCount - i);
    for (let j = 0; j < n; j++) {
      const sale = await prisma.sale.create({
        data: {
          businessId,
          customerId: customer.id,
          date: new Date(2025, 1, 1 + ((i + j) % 28)),
          discountPct: 0,
          taxPct: 0,
          loadingCharges: 0,
          transportCharges: 0,
          labourCharges: 0,
          lines: {
            create: {
              productId: product.id,
              item: "Item",
              qty: 1,
              rate: 150,
              unit: "pcs",
            },
          },
        },
      });
      await prisma.invoice.create({
        data: {
          businessId,
          saleId: sale.id,
          number: `INV-PERF-${i + j}`,
          total: 150,
          paid: 0,
        },
      });
    }
  }
  metric("sales seeded", performance.now() - t3, String(salesCount));

  const t4 = performance.now();
  for (let i = 0; i < paymentCount; i += batch) {
    await prisma.payment.createMany({
      data: Array.from({ length: Math.min(batch, paymentCount - i) }, (_, j) => ({
        businessId,
        date: new Date(2025, 2, 1 + ((i + j) % 28)),
        type: "CUSTOMER",
        customerId: customer.id,
        amount: 10,
        method: "CASH",
      })),
    });
  }
  metric("payments seeded", performance.now() - t4, String(paymentCount));

  const t5 = performance.now();
  for (let i = 0; i < expenseCount; i += batch) {
    await prisma.expense.createMany({
      data: Array.from({ length: Math.min(batch, expenseCount - i) }, (_, j) => ({
        businessId,
        date: new Date(2025, 3, 1 + ((i + j) % 28)),
        label: `Expense ${i + j}`,
        category: "OTHER",
        amount: 50,
      })),
    });
  }
  metric("expenses seeded", performance.now() - t5, String(expenseCount));
}

async function benchmarkApi(token) {
  console.log("\nAPI benchmarks:");
  const boot = await api(token, "GET", "/ledger/bootstrap");
  metric("GET /ledger/bootstrap", boot.elapsed, `${boot.bytes} bytes`);

  const sales = await api(token, "GET", "/sales?page=1&limit=50");
  metric("GET /sales?page=1&limit=50", sales.elapsed, `${sales.data?.total ?? "?"} total`);

  const customers = await api(token, "GET", "/customers?page=1&limit=50");
  metric("GET /customers?page=1&limit=50", customers.elapsed, `${customers.data?.total ?? "?"} total`);

  const report = await api(token, "GET", "/reports/profit?mode=month&year=2025&month=3");
  metric("GET /reports/profit", report.elapsed);

  const stock = await api(token, "GET", "/inventory/stock");
  metric("GET /inventory/stock", stock.elapsed);
}

async function main() {
  console.log(`Performance seed → ${API} (SCALE=${SCALE})\n`);

  const health = await fetch(`${API}/health`).then((r) => r.ok).catch(() => false);
  if (!health) {
    console.error("Server not reachable. Start with: npm run start:dev");
    process.exit(1);
  }

  const { email, password, businessId } = await ensurePerfBusiness();
  await seedViaPrisma(businessId);

  const token = await login(email, password);
  await benchmarkApi(token);

  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
