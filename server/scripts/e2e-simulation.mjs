/**
 * End-to-end inventory system simulation.
 * Run: node scripts/e2e-simulation.mjs
 * Requires: server running on PORT (default 4000)
 */
import "dotenv/config";

const API = (process.env.TRADEX_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@tradex.app";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "TradexAdmin2026";
const RUN_ID = Date.now().toString(36);

const stats = {
  businesses: 0,
  owners: 0,
  staff: 0,
  purchases: 0,
  sales: 0,
  payments: 0,
  expenses: 0,
  reports: 0,
  permissionTests: 0,
  isolationTests: 0,
  edgeCases: 0,
  passed: 0,
  failed: 0,
};

const bugs = [];
const passes = [];

function bug(entry) {
  bugs.push(entry);
  stats.failed++;
}

function pass(msg) {
  passes.push(msg);
  stats.passed++;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function saleGrandTotal(lines, charges = {}) {
  const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.rate, 0));
  const discountPct = charges.discountPct ?? 0;
  const taxPct = charges.taxPct ?? 0;
  const discount = round2(subtotal * (discountPct / 100));
  const taxable = round2(subtotal - discount);
  const tax = round2(taxable * (taxPct / 100));
  const chargesTotal = round2(
    (charges.loading ?? 0) + (charges.transport ?? 0) + (charges.labour ?? 0),
  );
  return { subtotal, grandTotal: round2(taxable + tax + chargesTotal) };
}

async function api(token, method, path, body) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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
  return { ok: res.ok, status: res.status, data, message };
}

async function login(email, password) {
  const res = await api(null, "POST", "/auth/login", { email, password });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.message}`);
  return res.data.access_token;
}

async function healthCheck() {
  try {
    const res = await fetch(`${API}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

function expectStatus(result, expected, label) {
  if (result.status === expected) {
    pass(`${label} → HTTP ${expected}`);
    return true;
  }
  bug({
    title: label,
    severity: result.status >= 500 ? "Critical" : "High",
    role: "test",
    steps: label,
    expected: `HTTP ${expected}`,
    actual: `HTTP ${result.status}: ${result.message}`,
    area: "API",
  });
  return false;
}

function expectDenied(result, label) {
  stats.permissionTests++;
  if (result.status === 403 || result.status === 401) {
    pass(`${label} correctly denied (${result.status})`);
    return true;
  }
  bug({
    title: label,
    severity: "Critical",
    role: "staff/security",
    steps: label,
    expected: "HTTP 403 or 401",
    actual: `HTTP ${result.status} — request succeeded or returned unexpected status`,
    area: "authorization",
    rootCause: "No backend staff-page guard on tenant API endpoints",
  });
  return false;
}

function expectNotFound(result, label) {
  stats.isolationTests++;
  if (result.status === 404 || result.status === 400) {
    pass(`${label} blocked (${result.status})`);
    return true;
  }
  bug({
    title: label,
    severity: "Critical",
    role: "cross-tenant",
    steps: label,
    expected: "HTTP 404 or 400 — other business data inaccessible",
    actual: `HTTP ${result.status}`,
    area: "business isolation",
  });
  return false;
}

async function setupBusiness(superToken, key, plan) {
  const suffix = `${RUN_ID}-${key}`;
  const ownerEmail = `sim-${suffix}@test.local`;
  const password = "SimTestPass123!";

  const created = await api(superToken, "POST", "/owners", {
    name: `Owner ${key}`,
    email: ownerEmail,
    password,
    businessName: `Sim Business ${key}`,
    subscriptionPlanId: "sub_monthly",
    templateIds: [],
  });
  if (!created.ok) throw new Error(`Create owner ${key}: ${created.message}`);

  const ownerToken = await login(ownerEmail, password);
  stats.businesses++;
  stats.owners++;

  const ctx = {
    key,
    suffix,
    ownerEmail,
    password,
    ownerToken,
    ownerId: created.data.user?.id ?? created.data.id,
    businessId: created.data.user?.businessId ?? created.data.business?.id,
    businessName: `Sim Business ${key}`,
    ids: {},
    ledger: {
      purchases: [],
      sales: [],
      payments: [],
      expenses: [],
      products: [],
    },
    expected: {
      purchaseGoods: 0,
      purchasePaid: 0,
      salesTotal: 0,
      salesPaid: 0,
      customerPayments: 0,
      supplierPayments: 0,
      expenses: 0,
      stockByProduct: {},
    },
  };

  // Staff accounts
  // Two staff roles per business
  const staffDefs = [
    { name: "Staff Sales", email: `staff-sales-${suffix}@test.local`, access: ["sales", "dashboard"] },
    { name: "Staff Cust", email: `staff-cust-${suffix}@test.local`, access: ["customers", "dashboard"] },
  ];
  for (const s of staffDefs) {
    const r = await api(ownerToken, "POST", "/users", {
      name: s.name,
      email: s.email,
      password,
      title: s.name,
      access: s.access,
      role: "SUBADMIN",
    });
    if (!r.ok) throw new Error(`Create staff ${s.email}: ${r.message}`);
    s.id = r.data.id;
    s.token = await login(s.email, password);
    stats.staff++;
  }
  ctx.staff = staffDefs;

  // Suppliers
  const supA = await api(ownerToken, "POST", "/suppliers", {
    name: `Supplier A ${key}`,
    mill: `Mill A ${key}`,
    phone: "03001234001",
  });
  const supB = await api(ownerToken, "POST", "/suppliers", {
    name: `Supplier B ${key}`,
    mill: `Mill B ${key}`,
    phone: "03001234002",
  });
  ctx.ids.supplierA = supA.data.id;
  ctx.ids.supplierB = supB.data.id;

  // Customers
  const custA = await api(ownerToken, "POST", "/customers", {
    name: `Customer A ${key}`,
    shop: `Shop A ${key}`,
    phone: "03009876001",
  });
  const custB = await api(ownerToken, "POST", "/customers", {
    name: `Customer B ${key}`,
    shop: `Shop B ${key}`,
    phone: "03009876002",
  });
  ctx.ids.customerA = custA.data.id;
  ctx.ids.customerB = custB.data.id;

  // Products
  const prodSteel = await api(ownerToken, "POST", "/products", {
    name: `Steel ${key}`,
    unit: "kg",
    description: "Sim steel",
  });
  const prodCement = await api(ownerToken, "POST", "/products", {
    name: `Cement ${key}`,
    unit: "bag",
    description: "Sim cement",
  });
  ctx.ids.productSteel = prodSteel.data.id;
  ctx.ids.productCement = prodCement.data.id;
  ctx.ledger.products.push(prodSteel.data, prodCement.data);
  ctx.expected.stockByProduct[prodSteel.data.id] = 0;
  ctx.expected.stockByProduct[prodCement.data.id] = 0;

  // --- Purchases ---
  const p1 = await api(ownerToken, "POST", "/purchases", {
    date: "2026-09-05",
    supplierId: ctx.ids.supplierA,
    transport: 500,
    loading: 200,
    labour: 100,
    otherCost: 50,
    paid: 3000,
    lines: [
      {
        productId: ctx.ids.productSteel,
        item: "Steel coil",
        qty: 100,
        unit: "kg",
        rate: 50,
        sellRate: 65,
      },
    ],
  });
  if (!p1.ok) throw new Error(`Purchase 1 ${key}: ${p1.message}`);
  stats.purchases++;
  ctx.ledger.purchases.push(p1.data);
  ctx.ids.purchase1 = p1.data.id;
  ctx.expected.purchaseGoods += 100 * 50;
  ctx.expected.purchasePaid += 3000;
  ctx.expected.stockByProduct[ctx.ids.productSteel] += 100;

  const p2 = await api(ownerToken, "POST", "/purchases", {
    date: "2026-09-08",
    supplierId: ctx.ids.supplierB,
    paid: 0,
    lines: [
      {
        productId: ctx.ids.productCement,
        item: "Cement bag",
        qty: 50,
        unit: "bag",
        rate: 80,
        sellRate: 95,
      },
    ],
  });
  if (!p2.ok) throw new Error(`Purchase 2 ${key}: ${p2.message}`);
  stats.purchases++;
  ctx.ledger.purchases.push(p2.data);
  ctx.ids.purchase2 = p2.data.id;
  ctx.expected.purchaseGoods += 50 * 80;
  ctx.expected.stockByProduct[ctx.ids.productCement] += 50;

  // --- Sales ---
  const sale1Lines = [{ productId: ctx.ids.productSteel, item: "Steel coil", qty: 30, unit: "kg", rate: 65, purchaseId: ctx.ids.purchase1 }];
  const sale1Totals = saleGrandTotal(sale1Lines, { taxPct: 5, loading: 100 });
  const s1 = await api(ownerToken, "POST", "/sales", {
    date: "2026-09-10",
    customerId: ctx.ids.customerA,
    taxPct: 5,
    loadingCharges: 100,
    paidNow: 1000,
    lines: sale1Lines,
  });
  if (!s1.ok) throw new Error(`Sale 1 ${key}: ${s1.message}`);
  stats.sales++;
  ctx.ledger.sales.push(s1.data);
  ctx.ids.sale1 = s1.data.id;
  ctx.expected.salesTotal += sale1Totals.grandTotal;
  ctx.expected.salesPaid += 1000;
  ctx.expected.stockByProduct[ctx.ids.productSteel] -= 30;

  const sale2Lines = [{ productId: ctx.ids.productCement, item: "Cement bag", qty: 10, unit: "bag", rate: 95, purchaseId: ctx.ids.purchase2 }];
  const sale2Totals = saleGrandTotal(sale2Lines, { discountPct: 10 });
  const s2 = await api(ownerToken, "POST", "/sales", {
    date: "2026-09-12",
    customerId: ctx.ids.customerB,
    discountPct: 10,
    paidNow: 0,
    lines: sale2Lines,
  });
  if (!s2.ok) throw new Error(`Sale 2 ${key}: ${s2.message}`);
  stats.sales++;
  ctx.ledger.sales.push(s2.data);
  ctx.ids.sale2 = s2.data.id;
  ctx.expected.salesTotal += sale2Totals.grandTotal;
  ctx.expected.stockByProduct[ctx.ids.productCement] -= 10;

  // Customer payment on sale1
  const payCust = await api(ownerToken, "POST", "/payments", {
    date: "2026-09-14",
    type: "CUSTOMER",
    customerId: ctx.ids.customerA,
    amount: 500,
    saleId: ctx.ids.sale1,
    method: "CASH",
    note: "Partial settlement",
  });
  if (!payCust.ok) throw new Error(`Customer payment ${key}: ${payCust.message}`);
  stats.payments++;
  ctx.ledger.payments.push(payCust.data);
  ctx.expected.customerPayments += 500;
  ctx.expected.salesPaid += 500;

  // Supplier payment
  const paySup = await api(ownerToken, "POST", "/payments", {
    date: "2026-09-15",
    type: "SUPPLIER",
    supplierId: ctx.ids.supplierB,
    amount: 2000,
    method: "BANK",
    note: "Partial mill payment",
  });
  if (!paySup.ok) throw new Error(`Supplier payment ${key}: ${paySup.message}`);
  stats.payments++;
  ctx.ledger.payments.push(paySup.data);
  ctx.expected.supplierPayments += 2000;
  ctx.expected.purchasePaid += 2000;

  // Expenses
  const exp1 = await api(ownerToken, "POST", "/expenses", {
    date: "2026-09-11",
    label: `Rent ${key}`,
    category: "RENT",
    amount: 1500,
  });
  const exp2 = await api(ownerToken, "POST", "/expenses", {
    date: "2026-09-13",
    label: `Transport ${key}`,
    category: "TRANSPORT",
    amount: 350.5,
    productId: ctx.ids.productSteel,
  });
  if (!exp1.ok || !exp2.ok) throw new Error(`Expense ${key} failed`);
  stats.expenses += 2;
  ctx.ledger.expenses.push(exp1.data, exp2.data);
  ctx.expected.expenses += 1500 + 350.5;

  return ctx;
}

async function verifyBusiness(ctx) {
  const { ownerToken, key, expected } = ctx;

  // Inventory stock
  const stock = await api(ownerToken, "GET", "/inventory/stock");
  if (!stock.ok) throw new Error(`Stock ${key}: ${stock.message}`);
  for (const row of stock.data) {
    const exp = expected.stockByProduct[row.productId];
    if (exp !== undefined) {
      const actual = Number(row.qty);
      if (Math.abs(actual - exp) < 0.01) {
        pass(`${key} stock ${row.productName ?? row.productId}: ${actual}`);
      } else {
        bug({
          title: `${key} inventory mismatch for ${row.productName}`,
          severity: "High",
          role: "owner",
          steps: "After purchases and sales",
          expected: exp,
          actual,
          area: "inventory",
        });
      }
    }
  }

  // Customer ledger
  const ledgerA = await api(ownerToken, "GET", `/customers/${ctx.ids.customerA}/ledger`);
  const totalDueA = ledgerA.data.totalDue;
  const sale1Fresh = await api(ownerToken, "GET", `/sales/${ctx.ids.sale1}`);
  const dueA = Number(sale1Fresh.data.invoice?.total ?? 0) - Number(sale1Fresh.data.invoice?.paid ?? 0);
  const ledgerDueForA = ledgerA.data.rows
    ?.filter((row) => row.saleId === ctx.ids.sale1)
    .reduce((sum, row) => sum + Math.max(0, row.due), 0) ?? dueA;
  if (Math.abs(totalDueA - ledgerDueForA) < 0.02 && Math.abs(dueA - ledgerDueForA) < 0.02) {
    pass(`${key} customer A ledger due = ${totalDueA}`);
  } else {
    bug({
      title: `${key} customer A balance mismatch`,
      severity: "High",
      role: "owner",
      steps: "Customer ledger after sales and payment",
      expected: dueA,
      actual: totalDueA,
      area: "customer balances",
    });
  }

  // Supplier payables
  const payB = await api(ownerToken, "GET", `/suppliers/${ctx.ids.supplierB}/payables`);
  const goodsB = 50 * 80;
  const expectedSupDueB = round2(goodsB - 2000);
  if (Math.abs(payB.data.totalDue - expectedSupDueB) < 0.02) {
    pass(`${key} supplier B payable = ${payB.data.totalDue}`);
  } else {
    bug({
      title: `${key} supplier B payable mismatch`,
      severity: "High",
      role: "owner",
      steps: "Supplier payables after purchase and payment",
      expected: expectedSupDueB,
      actual: payB.data.totalDue,
      area: "supplier balances",
    });
  }

  // Profit report September 2026
  const report = await api(
    ownerToken,
    "GET",
    "/reports/profit?mode=month&year=2026&month=9",
  );
  stats.reports++;
  if (!report.ok) throw new Error(`Report ${key}: ${report.message}`);

  const expCustomerDue = round2(
    ctx.ledger.sales.reduce((s, sale) => {
      const t = Number(sale.invoice?.total ?? 0);
      const p = Number(sale.invoice?.paid ?? 0);
      return s + Math.max(0, t - p);
    }, 0),
  );
  // refresh invoice paid from API
  const salesList = await api(ownerToken, "GET", "/sales?limit=50");
  let calcCustomerDue = 0;
  for (const sale of salesList.data.items ?? salesList.data) {
    const t = Number(sale.invoice?.total ?? 0);
    const p = Number(sale.invoice?.paid ?? 0);
    calcCustomerDue += Math.max(0, t - p);
  }
  calcCustomerDue = round2(calcCustomerDue);

  if (Math.abs(report.data.dues.customerDue - calcCustomerDue) < 0.05) {
    pass(`${key} report customerDue matches invoices (${calcCustomerDue})`);
  } else {
    bug({
      title: `${key} report customerDue mismatch`,
      severity: "Medium",
      role: "owner",
      steps: "Profit report vs invoice totals",
      expected: calcCustomerDue,
      actual: report.data.dues.customerDue,
      area: "reports",
    });
  }

  const calcSupplierDue = round2(
    ctx.expected.purchaseGoods - ctx.expected.purchasePaid,
  );
  if (Math.abs(report.data.dues.supplierDue - calcSupplierDue) < 0.05) {
    pass(`${key} report supplierDue = ${calcSupplierDue}`);
  } else {
    bug({
      title: `${key} report supplierDue mismatch`,
      severity: "Medium",
      role: "owner",
      steps: "Profit report vs purchase paid",
      expected: calcSupplierDue,
      actual: report.data.dues.supplierDue,
      area: "reports",
    });
  }

  const calcExpenses = round2(expected.expenses);
  if (Math.abs(report.data.cash.expenses - calcExpenses) < 0.05) {
    pass(`${key} report expenses = ${calcExpenses}`);
  } else {
    bug({
      title: `${key} report expenses mismatch`,
      severity: "Medium",
      role: "owner",
      steps: "Profit report expenses",
      expected: calcExpenses,
      actual: report.data.cash.expenses,
      area: "reports",
    });
  }

  ctx.report = report.data;
  ctx.calc = { calcCustomerDue, calcSupplierDue, calcExpenses };
}

async function testStaffPermissions(ctx) {
  const [salesOnly, customersOnly] = ctx.staff;
  const { ownerToken, ids, key } = ctx;

  // Sales-only staff creating a sale — should work
  stats.permissionTests++;
  const saleTry = await api(salesOnly.token, "POST", "/sales", {
    date: "2026-09-16",
    customerId: ids.customerA,
    paidNow: 0,
    lines: [
      {
        productId: ids.productSteel,
        item: "Steel",
        qty: 5,
        unit: "kg",
        rate: 65,
        purchaseId: ids.purchase1,
      },
    ],
  });
  if (saleTry.ok) {
    pass(`${key} sales-only staff can create sale (API allows)`);
    ctx.expected.stockByProduct[ids.productSteel] -= 5;
    stats.sales++;
  } else {
    bug({
      title: `${key} sales-only staff blocked from sales`,
      severity: "Medium",
      role: "staff-sales",
      steps: "POST /sales as sales-only staff",
      expected: "Success",
      actual: saleTry.message,
      area: "staff permissions",
    });
  }

  // Sales-only staff creating purchase — SHOULD be denied on backend
  stats.permissionTests++;
  const purchaseTry = await api(salesOnly.token, "POST", "/purchases", {
    date: "2026-09-16",
    supplierId: ids.supplierA,
    lines: [{ productId: ids.productSteel, item: "x", qty: 1, unit: "kg", rate: 10 }],
  });
  if (purchaseTry.ok) {
    bug({
      title: `${key} sales-only staff can create purchases via API`,
      severity: "Critical",
      role: "staff-sales",
      steps: "POST /purchases as sales-only staff",
      expected: "HTTP 403 Forbidden",
      actual: `HTTP ${purchaseTry.status} — purchase created`,
      area: "authorization",
      rootCause: "Tenant APIs only use JwtAuthGuard; staff page access is frontend-only",
    });
  } else if (purchaseTry.status === 403 || purchaseTry.status === 401) {
    pass(`${key} sales-only staff blocked from purchases`);
  }

  // Customers-only staff creating sale — SHOULD be denied
  stats.permissionTests++;
  const custSaleTry = await api(customersOnly.token, "POST", "/sales", {
    date: "2026-09-16",
    customerId: ids.customerA,
    lines: [{ productId: ids.productSteel, item: "x", qty: 1, unit: "kg", rate: 65, purchaseId: ids.purchase1 }],
  });
  if (custSaleTry.ok) {
    bug({
      title: `${key} customers-only staff can create sales via API`,
      severity: "Critical",
      role: "staff-customers",
      steps: "POST /sales as customers-only staff",
      expected: "HTTP 403",
      actual: `HTTP ${custSaleTry.status}`,
      area: "authorization",
      rootCause: "No staff access enforcement on backend",
    });
  } else if (custSaleTry.status === 403 || custSaleTry.status === 401) {
    pass(`${key} customers-only staff blocked from sales`);
  }

  // Staff cannot access owner staff management
  stats.permissionTests++;
  const staffListTry = await api(salesOnly.token, "GET", "/users");
  if (staffListTry.ok) {
    bug({
      title: `${key} staff can list/manage staff via API`,
      severity: "High",
      role: "staff",
      steps: "GET /users as SUBADMIN",
      expected: "HTTP 403",
      actual: `HTTP ${staffListTry.status}`,
      area: "authorization",
      rootCause: "RolesGuard on /users requires ADMIN — verify",
    });
  } else {
    expectDenied(staffListTry, `${key} staff blocked from /users`);
  }

  // Staff cannot access platform admin
  stats.permissionTests++;
  const platTry = await api(salesOnly.token, "GET", "/platform/overview");
  expectDenied(platTry, `${key} staff blocked from platform overview`);
}

async function testIsolation(ctxA, ctxB) {
  // A tries B's customer ledger
  const r1 = await api(ctxA.ownerToken, "GET", `/customers/${ctxB.ids.customerA}/ledger`);
  expectNotFound(r1, "Business A cannot read Business B customer ledger");

  // A tries B's purchase
  const r2 = await api(ctxA.ownerToken, "GET", `/purchases/${ctxB.ids.purchase1}`);
  expectNotFound(r2, "Business A cannot read Business B purchase");

  // A lists customers — must not include B's
  const r3 = await api(ctxA.ownerToken, "GET", "/customers?limit=100");
  const ids = (r3.data.items ?? r3.data).map((c) => c.id);
  stats.isolationTests++;
  if (ids.includes(ctxB.ids.customerA)) {
    bug({
      title: "Business B customer visible in Business A customer list",
      severity: "Critical",
      role: "owner A",
      steps: "GET /customers as Business A",
      expected: "Only Business A customers",
      actual: "Business B customer ID present",
      area: "business isolation",
    });
  } else {
    pass("Business A customer list excludes Business B data");
  }

  // A tries to create purchase using B's supplier ID
  const r4 = await api(ctxA.ownerToken, "POST", "/purchases", {
    date: "2026-09-17",
    supplierId: ctxB.ids.supplierA,
    lines: [{ productId: ctxA.ids.productSteel, item: "x", qty: 1, unit: "kg", rate: 10 }],
  });
  stats.isolationTests++;
  if (r4.ok) {
    bug({
      title: "Business A can purchase using Business B supplier ID",
      severity: "Critical",
      role: "owner A",
      steps: "POST /purchases with cross-tenant supplierId",
      expected: "Rejected",
      actual: "Purchase created",
      area: "business isolation",
    });
  } else {
    pass("Cross-tenant supplier on purchase rejected");
  }

  // Staff A tries B's sale
  const r5 = await api(ctxA.staff[0].token, "GET", `/sales/${ctxB.ids.sale1}`);
  expectNotFound(r5, "Business A staff cannot read Business B sale");
}

async function testEdgeCases(ctx) {
  const { ownerToken, ids, key } = ctx;

  // Oversell
  stats.edgeCases++;
  const over = await api(ownerToken, "POST", "/sales", {
    date: "2026-09-17",
    customerId: ids.customerA,
    lines: [
      {
        productId: ids.productSteel,
        item: "Steel",
        qty: 99999,
        unit: "kg",
        rate: 65,
        purchaseId: ids.purchase1,
      },
    ],
  });
  if (over.ok) {
    bug({
      title: `${key} oversell allowed`,
      severity: "Critical",
      role: "owner",
      steps: "Sell 99999 kg when stock is low",
      expected: "Rejected",
      actual: "Sale created",
      area: "inventory",
    });
  } else {
    pass(`${key} oversell rejected`);
  }

  // Paid exceeds goods
  stats.edgeCases++;
  const overPay = await api(ownerToken, "POST", "/purchases", {
    date: "2026-09-17",
    supplierId: ids.supplierA,
    paid: 999999,
    lines: [{ productId: ids.productSteel, item: "x", qty: 1, unit: "kg", rate: 10 }],
  });
  if (overPay.ok) {
    bug({
      title: `${key} purchase paid exceeds goods`,
      severity: "High",
      role: "owner",
      steps: "paid > goods total",
      expected: "Rejected",
      actual: "Accepted",
      area: "purchases",
    });
  } else {
    pass(`${key} over-payment on purchase rejected`);
  }

  // Zero qty line
  stats.edgeCases++;
  const zeroQty = await api(ownerToken, "POST", "/purchases", {
    date: "2026-09-17",
    supplierId: ids.supplierA,
    lines: [{ productId: ids.productSteel, item: "x", qty: 0, unit: "kg", rate: 10 }],
  });
  if (zeroQty.ok) {
    bug({
      title: `${key} zero qty purchase allowed`,
      severity: "Medium",
      role: "owner",
      steps: "qty=0",
      expected: "Rejected",
      actual: "Accepted",
      area: "validation",
    });
  } else {
    pass(`${key} zero qty purchase rejected`);
  }
}

async function testPlatformAdmin(superToken, contexts) {
  const overview = await api(superToken, "GET", "/platform/overview");
  if (!overview.ok) throw new Error(`Overview: ${overview.message}`);
  pass(`Platform overview loaded (${overview.data.totals?.businesses} businesses)`);

  const owners = await api(superToken, "GET", "/owners");
  if (!owners.ok) throw new Error(`Owners list: ${owners.message}`);
  const ownerRows = Array.isArray(owners.data) ? owners.data : owners.data?.items ?? [];
  const emails = ownerRows.map((o) => o.email);
  for (const ctx of contexts) {
    if (emails.includes(ctx.ownerEmail)) {
      pass(`Platform admin sees owner ${ctx.key}`);
    } else {
      bug({
        title: `Platform admin missing owner ${ctx.key}`,
        severity: "Medium",
        role: "SUPERADMIN",
        steps: "GET /owners",
        expected: ctx.ownerEmail,
        actual: "not in list",
        area: "platform admin",
      });
    }
  }

  // Superadmin should not mutate tenant purchase with tenant token confusion
  stats.isolationTests++;
  const cross = await api(superToken, "GET", `/purchases/${contexts[0].ids.purchase1}`);
  // Superadmin JWT has platform businessId — should NOT see tenant purchase
  if (cross.ok && cross.data?.id === contexts[0].ids.purchase1) {
    bug({
      title: "Superadmin can read tenant purchase via tenant API",
      severity: "High",
      role: "SUPERADMIN",
      steps: "GET /purchases/:tenantPurchaseId as SUPERADMIN",
      expected: "404 — platform admin uses /owners not tenant APIs",
      actual: "Purchase returned",
      area: "authorization",
    });
  } else {
    pass("Superadmin tenant purchase access blocked or not found");
  }
}

async function main() {
  console.log(`\n=== E2E Simulation RUN_ID=${RUN_ID} ===`);
  console.log(`API: ${API}\n`);

  if (!(await healthCheck())) {
    console.error("Server not reachable at", API);
    console.error("Start with: cd server && npm run start:dev");
    process.exit(1);
  }
  pass("Server health check OK");

  const superToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  pass("Platform admin login OK");

  const businesses = [];
  for (const key of ["A", "B", "C"]) {
    console.log(`\n--- Setting up Business ${key} ---`);
    const ctx = await setupBusiness(superToken, key);
    businesses.push(ctx);
    console.log(`Business ${key} ready: ${ctx.ownerEmail}`);
  }

  console.log("\n--- Verifying calculations per business ---");
  for (const ctx of businesses) {
    await verifyBusiness(ctx);
    await testStaffPermissions(ctx);
    await testEdgeCases(ctx);
  }

  console.log("\n--- Cross-business isolation ---");
  await testIsolation(businesses[0], businesses[1]);
  await testIsolation(businesses[1], businesses[2]);

  console.log("\n--- Platform admin ---");
  await testPlatformAdmin(superToken, businesses);

  // Print report
  console.log("\n" + "=".repeat(60));
  console.log("TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`Businesses tested:     ${stats.businesses}`);
  console.log(`Owners tested:         ${stats.owners}`);
  console.log(`Staff accounts:        ${stats.staff}`);
  console.log(`Purchases created:     ${stats.purchases}`);
  console.log(`Sales created:         ${stats.sales}`);
  console.log(`Payments created:      ${stats.payments}`);
  console.log(`Expenses created:      ${stats.expenses}`);
  console.log(`Reports verified:      ${stats.reports}`);
  console.log(`Permission tests:      ${stats.permissionTests}`);
  console.log(`Isolation tests:       ${stats.isolationTests}`);
  console.log(`Edge case tests:       ${stats.edgeCases}`);
  console.log(`Checks passed:         ${stats.passed}`);
  console.log(`Bugs found:            ${bugs.length}`);

  if (bugs.length) {
    console.log("\n" + "=".repeat(60));
    console.log("BUGS FOUND");
    console.log("=".repeat(60));
    bugs.forEach((b, i) => {
      console.log(`\n${i + 1}. [${b.severity}] ${b.title}`);
      console.log(`   Role: ${b.role}`);
      console.log(`   Area: ${b.area}`);
      console.log(`   Steps: ${b.steps}`);
      console.log(`   Expected: ${b.expected}`);
      console.log(`   Actual: ${b.actual}`);
      if (b.rootCause) console.log(`   Root cause: ${b.rootCause}`);
    });
  }

  console.log("\n" + "=".repeat(60));
  console.log("SECURITY FINDINGS");
  console.log("=".repeat(60));
  const security = bugs.filter((b) =>
    ["authorization", "business isolation"].includes(b.area),
  );
  if (!security.length) {
    console.log("No critical security bugs detected in this run.");
  } else {
    security.forEach((b) => console.log(`- [${b.severity}] ${b.title}`));
  }

  console.log("\n" + "=".repeat(60));
  console.log("CALCULATION VERIFICATION (Business A sample)");
  console.log("=".repeat(60));
  const a = businesses[0];
  if (a.calc) {
    console.log(`Customer due (calc):  ${a.calc.calcCustomerDue}`);
    console.log(`Customer due (report): ${a.report?.dues?.customerDue}`);
    console.log(`Supplier due (calc):  ${a.calc.calcSupplierDue}`);
    console.log(`Supplier due (report): ${a.report?.dues?.supplierDue}`);
    console.log(`Expenses (calc):      ${a.calc.calcExpenses}`);
    console.log(`Expenses (report):    ${a.report?.cash?.expenses}`);
    console.log(`Net profit (report):  ${a.report?.profit?.netProfit}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("FINAL ASSESSMENT");
  console.log("=".repeat(60));
  const critical = bugs.filter((b) => b.severity === "Critical").length;
  const high = bugs.filter((b) => b.severity === "High").length;
  if (critical === 0 && high === 0) {
    console.log("Core flows passed. Review Medium/Low items if any.");
  } else {
    console.log(`${critical} Critical and ${high} High severity issues need fixing before production.`);
  }
  console.log(`\nTest businesses created (cleanup manually if needed):`);
  businesses.forEach((b) => console.log(`  - ${b.businessName}: ${b.ownerEmail}`));

  process.exit(bugs.some((b) => b.severity === "Critical") ? 1 : 0);
}

main().catch((err) => {
  console.error("\nSimulation aborted:", err.message);
  process.exit(1);
});
