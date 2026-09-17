/**
 * Production hardening verification suite.
 * Run: node scripts/production-hardening.mjs
 * Requires server on PORT (default 4000) and DATABASE_URL.
 */
import "dotenv/config";

const API = (process.env.TRADEX_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@tradex.app";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "TradexAdmin2026";
const RUN_ID = Date.now().toString(36);

const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
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
  const message = Array.isArray(data?.message)
    ? data.message.join("; ")
    : data?.message ?? res.statusText;
  return { ok: res.ok, status: res.status, data, message, elapsed, bytes: text.length };
}

async function login(email, password) {
  const res = await api(null, "POST", "/auth/login", { email, password });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.message}`);
  return res.data.access_token;
}

async function fetchAllPages(token, path, limit = 100) {
  const items = [];
  let page = 1;
  let pages = 1;
  do {
    const res = await api(token, "GET", `${path}?page=${page}&limit=${limit}`);
    if (!res.ok) throw new Error(res.message);
    items.push(...(res.data.items ?? []));
    pages = res.data.pages ?? 1;
    page += 1;
  } while (page <= pages && page <= 200);
  return items;
}

async function createOwner(adminToken, suffix) {
  const email = `hardening-${suffix}-${RUN_ID}@test.local`;
  const password = "TestOwner2026!";
  const res = await api(adminToken, "POST", "/owners", {
    email,
    password,
    name: `Hardening Owner ${suffix}`,
    businessName: `Hardening Biz ${suffix} ${RUN_ID}`,
  });
  if (!res.ok) throw new Error(`Create owner ${suffix}: ${res.message}`);
  const token = await login(email, password);
  return { email, password, token, owner: res.data, businessId: res.data.business.id };
}

async function createProduct(token, name) {
  const res = await api(token, "POST", "/products", { name, unit: "pcs" });
  if (!res.ok) throw new Error(`Create product: ${res.message}`);
  return res.data;
}

async function createCustomer(token, name) {
  const res = await api(token, "POST", "/customers", {
    name,
    shop: "Test Shop",
    phone: "03001234567",
  });
  if (!res.ok) throw new Error(`Create customer: ${res.message}`);
  return res.data;
}

async function createSupplier(token, name) {
  const res = await api(token, "POST", "/suppliers", {
    name,
    mill: "Mill",
    phone: "03001234567",
  });
  if (!res.ok) throw new Error(`Create supplier: ${res.message}`);
  return res.data;
}

async function purchaseStock(token, supplierId, productId, qty = 100, rate = 10) {
  const res = await api(token, "POST", "/purchases", {
    date: new Date().toISOString().slice(0, 10),
    supplierId,
    lines: [{ productId, item: "Item", qty, rate, unit: "pcs" }],
    paid: 0,
  });
  if (!res.ok) throw new Error(`Purchase: ${res.message}`);
  return res.data;
}

async function trySale(token, customerId, productId, qty) {
  return api(token, "POST", "/sales", {
    date: new Date().toISOString().slice(0, 10),
    customerId,
    lines: [{ productId, item: "Item", qty, rate: 20, unit: "pcs" }],
    paidNow: 0,
  });
}

async function main() {
  console.log(`Production hardening tests → ${API}\n`);

  const health = await fetch(`${API}/health`).then((r) => r.ok).catch(() => false);
  if (!health) {
    console.error("Server not reachable. Start with: npm run start:dev");
    process.exit(1);
  }

  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  record("Super admin login", true);

  const bootstrap = await api(adminToken, "GET", "/ledger/bootstrap");
  record("Bootstrap responds", bootstrap.status === 200 || bootstrap.status === 403,
    bootstrap.status === 403 ? "superadmin has no tenant bootstrap" : `v${bootstrap.data?.data?.version ?? bootstrap.data?.version}`);

  const bizA = await createOwner(adminToken, "a");
  const bizB = await createOwner(adminToken, "b");
  record("Created isolated businesses", true, `${bizA.businessId}, ${bizB.businessId}`);

  const bootA = await api(bizA.token, "GET", "/ledger/bootstrap");
  const bootPayload = bootA.data?.data ?? bootA.data;
  const bootBytes = bootA.bytes;
  const txCollections = ["customers", "sales", "purchases", "payments", "expenses"];
  const emptyTx = txCollections.every((k) => (bootPayload?.[k] ?? []).length === 0);
  record("Slim bootstrap (empty transaction arrays)", emptyTx && bootPayload?.version === 3,
    `${bootBytes} bytes, counts=${JSON.stringify(bootPayload?.counts ?? {})}`);
  record("Bootstrap response time < 3s", bootA.elapsed < 3000, `${bootA.elapsed.toFixed(0)}ms`);

  const overLimit = await api(bizA.token, "GET", "/customers?limit=500");
  record("Pagination rejects limit > 100", overLimit.status === 400, `status=${overLimit.status}`);

  const paginated = await api(bizA.token, "GET", "/customers?page=1&limit=50");
  record("Paginated customers shape", paginated.ok && Array.isArray(paginated.data?.items),
    `total=${paginated.data?.total}`);

  const productA = await createProduct(bizA.token, `Prod A ${RUN_ID}`);
  const productB = await createProduct(bizB.token, `Prod B ${RUN_ID}`);
  const customerA = await createCustomer(bizA.token, `Customer A ${RUN_ID}`);
  const supplierA = await createSupplier(bizA.token, `Supplier A ${RUN_ID}`);
  await purchaseStock(bizA.token, supplierA.id, productA.id, 100);

  const crossRead = await api(bizA.token, "GET", `/products/${productB.id}`);
  record("Cross-tenant product read blocked", crossRead.status === 404, `status=${crossRead.status}`);

  const crossSale = await api(bizA.token, "POST", "/sales", {
    date: new Date().toISOString().slice(0, 10),
    customerId: customerA.id,
    lines: [{ productId: productB.id, item: "X", qty: 1, rate: 10, unit: "pcs" }],
  });
  record("Cross-tenant product in sale blocked", crossSale.status === 400 || crossSale.status === 404,
    `status=${crossSale.status}`);

  const staffRes = await api(bizA.token, "POST", "/users", {
    email: `staff-inv-${RUN_ID}@test.local`,
    password: "StaffPass2026!",
    name: "Inventory Staff",
    title: "Clerk",
    access: ["inventory"],
    role: "SUBADMIN",
  });
  record("Staff creation", staffRes.ok);
  const staffToken = staffRes.ok
    ? await login(`staff-inv-${RUN_ID}@test.local`, "StaffPass2026!")
    : null;

  if (staffToken) {
    const deniedSale = await api(staffToken, "GET", "/sales");
    record("Staff without sales permission blocked", deniedSale.status === 403, `status=${deniedSale.status}`);
    const allowedInv = await api(staffToken, "GET", "/inventory/stock");
    record("Staff with inventory permission allowed", allowedInv.ok, `status=${allowedInv.status}`);
  }

  const concurrentSales = Array.from({ length: 20 }, () =>
    trySale(bizA.token, customerA.id, productA.id, 6),
  );
  const saleResults = await Promise.all(concurrentSales);
  const successes = saleResults.filter((r) => r.ok).length;
  const stockAfter = await api(bizA.token, "GET", "/inventory/stock");
  const stockQty = (stockAfter.data ?? []).find((r) => r.productId === productA.id)?.qty ?? 0;
  record("Concurrent sales respect stock (≤100 purchased)", stockQty >= -0.001 && successes <= 17,
    `successes=${successes}, remaining stock=${stockQty}`);

  const reportRange = await api(bizA.token, "GET",
    `/reports/profit?mode=range&from=2000-01-01&to=2030-01-01`);
  record("Report range > 2 years rejected", reportRange.status === 400, `status=${reportRange.status}`);

  const reportOk = await api(bizA.token, "GET", `/reports/profit?mode=month&year=2026&month=9`);
  record("Report within range succeeds", reportOk.ok, `${reportOk.elapsed.toFixed(0)}ms`);

  const decimalCheck = await api(bizA.token, "GET", "/purchases?limit=1");
  const sample = decimalCheck.data?.items?.[0];
  const rateType = sample?.lines?.[0]?.rate != null ? typeof sample.lines[0].rate : "n/a";
  record("Money serialized as string in API", rateType === "string", `rate type=${rateType}`);

  const ownersPage = await api(adminToken, "GET", "/owners?page=1&limit=50");
  record("Owners list paginated", ownersPage.ok && Array.isArray(ownersPage.data?.items),
    `total=${ownersPage.data?.total}`);

  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
  if (results.some((r) => !r.pass)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
