/**
 * Final performance audit — measured benchmarks, query counts, EXPLAIN, concurrency.
 *
 * Usage:
 *   node scripts/final-performance-audit.mjs
 *   SCALE=1000 node scripts/final-performance-audit.mjs
 *   BUSINESS_ID=<cuid> node scripts/final-performance-audit.mjs
 *
 * Requires: server on PORT 4000, DATABASE_URL, perf owner from performance-seed.
 */
import "dotenv/config";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";

const API = (process.env.TRADEX_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@tradex.app";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "TradexAdmin2026";
const ITERATIONS = Number(process.env.ITERATIONS ?? "10");
const CONCURRENCY = Number(process.env.CONCURRENCY ?? "20");

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
  log: [],
});

const results = {
  scale: null,
  businessId: null,
  endpoints: [],
  customerBreakdown: null,
  reportsProfile: null,
  search: [],
  indexes: [],
  pgStats: null,
  concurrency: [],
  bootstrap: null,
};

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function stats(times) {
  const sorted = [...times].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  };
}

async function api(token, method, path, body) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const started = performance.now();
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
  return { ok: res.ok, status: res.status, data, elapsed, bytes: text.length, message: data?.message };
}

async function login(email, password) {
  const res = await api(null, "POST", "/auth/login", { email, password });
  if (!res.ok) throw new Error(`Login failed: ${res.message}`);
  return res.data.access_token;
}

async function findPerfBusiness() {
  const user = await prisma.user.findFirst({
    where: { email: { contains: "@test.local" }, role: "ADMIN" },
    orderBy: { createdAt: "desc" },
    select: { businessId: true, email: true },
  });
  if (!user) throw new Error("No perf business found. Run: node scripts/performance-seed.mjs");
  return { businessId: user.businessId, email: user.email };
}

async function countQueries(fn) {
  const counted = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
    log: [{ emit: "event", level: "query" }],
  });
  const queries = [];
  counted.$on("query", (e) => {
    queries.push({ query: e.query, duration: e.duration });
  });
  const started = performance.now();
  const memBefore = process.memoryUsage().heapUsed;
  const result = await fn(counted);
  const memAfter = process.memoryUsage().heapUsed;
  await counted.$disconnect();
  const dbMs = queries.reduce((s, q) => s + q.duration, 0);
  return {
    result,
    queries,
    queryCount: queries.length,
    dbMs,
    totalMs: performance.now() - started,
    nodeMs: performance.now() - started - dbMs,
    heapDeltaMb: (memAfter - memBefore) / 1024 / 1024,
  };
}

async function profileCustomerList(businessId) {
  const where = { businessId, active: true };
  const warmed = await prisma.customer.findMany({ where, take: 50 });
  void warmed;

  const direct = await countQueries(async (db) => {
    const [items, total] = await db.$transaction([
      db.customer.findMany({ where, skip: 0, take: 50, orderBy: { createdAt: "asc" } }),
      db.customer.count({ where }),
    ]);
    return { items, total };
  });

  const jwt = await countQueries(async (db) => {
    const user = await db.user.findFirst({
      where: { businessId, role: "ADMIN", active: true },
      select: {
        id: true,
        tokenVersion: true,
        access: true,
        business: {
          select: {
            slug: true,
            subscriptionStatus: true,
            subscriptionEndsAt: true,
            subscriptionPlanDef: { select: { billingCycle: true, allowedPages: true } },
          },
        },
      },
    });
    return user;
  });

  return {
    rows: direct.result.total,
    payloadEstimate: JSON.stringify(direct.result.items).length,
    directDb: {
      queries: direct.queryCount,
      dbMs: Math.round(direct.dbMs * 100) / 100,
      totalMs: Math.round(direct.totalMs * 100) / 100,
      nodeMs: Math.round(direct.nodeMs * 100) / 100,
    },
    jwtValidation: {
      queries: jwt.queryCount,
      dbMs: Math.round(jwt.dbMs * 100) / 100,
      totalMs: Math.round(jwt.totalMs * 100) / 100,
    },
  };
}

async function profileReports(businessId) {
  const period = { from: new Date("2025-03-01"), to: new Date("2025-03-31") };

  const fetchPhase = await countQueries(async (db) => {
    const [purchases, sales, expenses, costPurchases] = await Promise.all([
      db.purchase.findMany({
        where: { businessId, date: { gte: period.from, lte: period.to } },
        include: { lines: { include: { product: { select: { id: true, name: true, unit: true } } } } },
      }),
      db.sale.findMany({
        where: { businessId, date: { gte: period.from, lte: period.to } },
        include: { lines: { include: { product: { select: { id: true, name: true, unit: true } } } } },
      }),
      db.expense.findMany({
        where: { businessId, date: { gte: period.from, lte: period.to } },
      }),
      db.purchase.findMany({
        where: { businessId, date: { lte: period.to } },
        include: { lines: true },
      }),
    ]);
    return { purchases, sales, expenses, costPurchases };
  });

  const { purchases, sales, expenses, costPurchases } = fetchPhase.result;
  const purchaseLines = purchases.reduce((s, p) => s + p.lines.length, 0);
  const saleLines = sales.reduce((s, p) => s + p.lines.length, 0);
  const costLines = costPurchases.reduce((s, p) => s + p.lines.length, 0);

  const calcStarted = performance.now();
  let stockCost = 0;
  for (const p of costPurchases) {
    const goods = p.lines.reduce((sum, l) => sum + Number(l.qty) * Number(l.rate), 0);
    if (goods <= 0) continue;
    for (const line of p.lines) {
      stockCost += Number(line.qty) * Number(line.rate);
    }
  }
  const calcMs = performance.now() - calcStarted;

  return {
    period: "2025-03",
    rowsLoaded: {
      purchases: purchases.length,
      purchaseLines,
      sales: sales.length,
      saleLines,
      expenses: expenses.length,
      costPurchases: costPurchases.length,
      costLines,
    },
    fetch: {
      queries: fetchPhase.queryCount,
      dbMs: Math.round(fetchPhase.dbMs),
      totalMs: Math.round(fetchPhase.totalMs),
      heapDeltaMb: Math.round(fetchPhase.heapDeltaMb * 100) / 100,
    },
    nodeCalcMs: Math.round(calcMs * 100) / 100,
    cogsSqlSafe: false,
    cogsSqlReason:
      "Weighted landed-cost averaging per purchase+product and lot-specific vs weighted fallback cannot be reproduced exactly in SQL without risking divergent COGS.",
  };
}

async function benchmarkSearch(businessId, count) {
  const term = "Customer 1";
  const started = performance.now();
  const rows = await prisma.$queryRaw`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT * FROM "Customer"
    WHERE "businessId" = ${businessId}
      AND active = true
      AND (
        name ILIKE ${"%" + term + "%"}
        OR shop ILIKE ${"%" + term + "%"}
        OR phone ILIKE ${"%" + term + "%"}
      )
    LIMIT 50
  `;
  const elapsed = performance.now() - started;
  const plan = rows.map((r) => r["QUERY PLAN"]).join("\n");
  const seqScan = plan.includes("Seq Scan");
  return { customerCount: count, elapsedMs: Math.round(elapsed), seqScan, planSnippet: plan.split("\n")[0] };
}

async function benchmarkEndpoint(token, name, path, iterations = ITERATIONS) {
  for (let i = 0; i < 3; i++) await api(token, "GET", path);
  const times = [];
  let bytes = 0;
  for (let i = 0; i < iterations; i++) {
    const res = await api(token, "GET", path);
    if (!res.ok) throw new Error(`${name} failed: ${res.message}`);
    times.push(res.elapsed);
    bytes = res.bytes;
  }
  return { name, path, ...stats(times), bytes, iterations };
}

async function concurrentBench(token, name, path, n = CONCURRENCY) {
  const started = performance.now();
  const results = await Promise.all(
    Array.from({ length: n }, () => api(token, "GET", path)),
  );
  const elapsed = performance.now() - started;
  const failures = results.filter((r) => !r.ok).length;
  const times = results.map((r) => r.elapsed);
  return { name, concurrency: n, wallMs: Math.round(elapsed), failures, ...stats(times) };
}

async function explainIndex(label, sql, ...params) {
  const rows = await prisma.$queryRawUnsafe(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
    ...params,
  );
  const plan = rows.map((r) => r["QUERY PLAN"]).join("\n");
  const indexScan = /Index Scan|Bitmap Index Scan|Index Only Scan/.test(plan);
  const execMatch = plan.match(/Execution Time: ([\d.]+) ms/);
  return { label, indexScan, executionMs: execMatch ? Number(execMatch[1]) : null, plan: plan.split("\n").slice(0, 6).join(" | ") };
}

async function pgStatistics() {
  const [tables, vacuum] = await Promise.all([
    prisma.$queryRaw`
      SELECT relname AS table_name,
             n_live_tup::bigint AS live_rows,
             n_dead_tup::bigint AS dead_rows,
             last_analyze,
             last_autoanalyze
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_live_tup DESC
      LIMIT 15
    `,
    prisma.$queryRaw`
      SELECT name, setting FROM pg_settings
      WHERE name IN ('autovacuum', 'max_connections', 'shared_buffers')
    `,
  ]);
  return { tables, vacuum };
}

async function measureScale(businessId) {
  const [customers, suppliers, sales, purchases, payments, expenses] = await Promise.all([
    prisma.customer.count({ where: { businessId } }),
    prisma.supplier.count({ where: { businessId } }),
    prisma.sale.count({ where: { businessId } }),
    prisma.purchase.count({ where: { businessId } }),
    prisma.payment.count({ where: { businessId } }),
    prisma.expense.count({ where: { businessId } }),
  ]);
  return { customers, suppliers, sales, purchases, payments, expenses };
}

async function main() {
  console.log("Final Performance Audit\n");

  const health = await fetch(`${API}/health`).then((r) => r.ok).catch(() => false);
  if (!health) {
    console.error("Server not reachable at", API);
    process.exit(1);
  }

  let businessId;
  let ownerEmail;
  if (process.env.BUSINESS_ID) {
    businessId = process.env.BUSINESS_ID;
    const user = await prisma.user.findFirst({
      where: { businessId, role: "ADMIN" },
      select: { email: true },
    });
    if (!user) throw new Error("No admin user for business");
    ownerEmail = user.email;
  } else {
    const perf = await findPerfBusiness();
    businessId = perf.businessId;
    ownerEmail = perf.email;
  }

  const password = process.env.PERF_PASSWORD ?? "PerfTest2026!";
  let token;
  try {
    token = await login(ownerEmail, password);
  } catch {
    token = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  }

  const scale = await measureScale(businessId);
  results.scale = scale;
  results.businessId = businessId;

  console.log("Dataset:", scale);
  console.log("\n--- Customer endpoint breakdown ---");
  results.customerBreakdown = await profileCustomerList(businessId);
  console.log(JSON.stringify(results.customerBreakdown, null, 2));

  console.log("\n--- Reports / COGS profile ---");
  results.reportsProfile = await profileReports(businessId);
  console.log(JSON.stringify(results.reportsProfile, null, 2));

  console.log("\n--- Search EXPLAIN ---");
  results.search = await benchmarkSearch(businessId, scale.customers);
  console.log(results.search);

  console.log("\n--- Endpoint benchmarks (warm, HTTP) ---");
  const paths = [
    ["bootstrap", "/ledger/bootstrap"],
    ["transactions", "/ledger/transactions"],
    ["customers", "/customers?page=1&limit=50"],
    ["suppliers", "/suppliers?page=1&limit=50"],
    ["sales", "/sales?page=1&limit=50"],
    ["purchases", "/purchases?page=1&limit=50"],
    ["payments", "/payments?page=1&limit=50"],
    ["inventory/stock", "/inventory/stock"],
    ["reports", "/reports/profit?mode=month&year=2025&month=3"],
  ];
  for (const [name, path] of paths) {
    const row = await benchmarkEndpoint(token, name, path);
    results.endpoints.push(row);
    console.log(
      `${name.padEnd(14)} p50=${row.p50.toFixed(0)}ms p95=${row.p95.toFixed(0)}ms bytes=${row.bytes}`,
    );
  }

  console.log("\n--- Index validation ---");
  const indexTests = [
    ["Customer list", `SELECT * FROM "Customer" WHERE "businessId" = $1 AND active = true ORDER BY "createdAt" ASC LIMIT 50`, businessId],
    ["Sale FIFO", `SELECT s.id FROM "Sale" s INNER JOIN "Invoice" i ON i."saleId" = s.id WHERE s."businessId" = $1 AND i.total > 0 ORDER BY s.date ASC LIMIT 50`, businessId],
    ["Purchase supplier FIFO", `SELECT id FROM "Purchase" WHERE "businessId" = $1 ORDER BY date ASC, "createdAt" ASC LIMIT 50`, businessId],
    ["SaleLine lot", `SELECT "purchaseId", "productId", "variantId", SUM(qty) FROM "SaleLine" sl INNER JOIN "Sale" s ON s.id = sl."saleId" WHERE s."businessId" = $1 AND sl."purchaseId" IS NOT NULL GROUP BY 1,2,3`, businessId],
  ];
  for (const [label, sql, ...params] of indexTests) {
    const row = await explainIndex(label, sql, ...params);
    results.indexes.push(row);
    console.log(`${label}: indexScan=${row.indexScan} exec=${row.executionMs}ms`);
  }

  console.log("\n--- PostgreSQL statistics ---");
  results.pgStats = await pgStatistics();
  console.log(results.pgStats.tables.slice(0, 5));

  console.log(`\n--- Concurrency (${CONCURRENCY} parallel) ---`);
  for (const [name, path] of [
    ["customers", "/customers?page=1&limit=50"],
    ["sales", "/sales?page=1&limit=50"],
    ["inventory", "/inventory/stock"],
    ["bootstrap", "/ledger/bootstrap"],
  ]) {
    const row = await concurrentBench(token, name, path);
    results.concurrency.push(row);
    console.log(`${name}: wall=${row.wallMs}ms p95=${row.p95.toFixed(0)}ms failures=${row.failures}`);
  }

  const outPath = new URL("../audit-results/final-performance-audit.json", import.meta.url);
  const fs = await import("node:fs");
  const dir = new URL("../audit-results/", import.meta.url);
  fs.mkdirSync(dir.pathname.replace(/^\/([A-Z]:)/, "$1"), { recursive: true });
  const serialize = (value) =>
    JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  fs.writeFileSync(
    outPath.pathname.replace(/^\/([A-Z]:)/, "$1"),
    serialize(results),
  );
  console.log("\nResults written to server/audit-results/final-performance-audit.json");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
