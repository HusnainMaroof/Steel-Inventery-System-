// Dev-only browser latency probe. Not part of the app build.
// Usage (credentials via env, never stored in this file):
//   BASE_URL=http://localhost:3000 PERF_EMAIL=... PERF_PASSWORD=... RUNS=3 node scripts/browser-perf.mjs
//   Add WRITES=1 to also submit real supplier, purchase, payment and sale records (dev DB only).
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
// Explicit per-step timeout. Failures surface in ~15s instead of hanging for 60s.
const TIMEOUT = Number(process.env.STEP_TIMEOUT_MS ?? 15000);
const EMAIL = process.env.PERF_EMAIL;
const PASSWORD = process.env.PERF_PASSWORD;
const RUNS = Number(process.env.RUNS ?? 3);
const WRITES = process.env.WRITES === "1";
const CUSTOMER_PREFIX = process.env.PERF_CUSTOMER_PREFIX ?? "PerfBrowser r1";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

if (!EMAIL || !PASSWORD) {
  console.error("Set PERF_EMAIL and PERF_PASSWORD");
  process.exit(1);
}
// WRITES=1 needs the operator to confirm the DB identity first (checked with a read-only query).
if (WRITES && process.env.VERIFIED_TEST_DB !== "tijaratt_test") {
  console.error("WRITES=1 refused: set VERIFIED_TEST_DB=tijaratt_test only after confirming the DB identity.");
  process.exit(1);
}

const now = () => performance.now();
const round = (n) => Math.round(n);

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await page.type('input[name="email"]', EMAIL);
  await page.type('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: TIMEOUT }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(() => !location.pathname.startsWith("/login"), { timeout: TIMEOUT });
  return new URL(page.url()).pathname.split("/").filter(Boolean)[0];
}

// Click the first enabled button/link whose text matches.
async function clickByText(page, pattern) {
  await page.waitForFunction(
    (src) => {
      const re = new RegExp(src, "i");
      return [...document.querySelectorAll("button, a, [role=button]")].some(
        (el) => re.test(el.textContent ?? "") && !(el instanceof HTMLButtonElement && el.disabled),
      );
    },
    { timeout: TIMEOUT },
    pattern.source,
  );
  await page.evaluate((src) => {
    const re = new RegExp(src, "i");
    const el = [...document.querySelectorAll("button, a, [role=button]")].find(
      (e) => re.test(e.textContent ?? "") && !(e instanceof HTMLButtonElement && e.disabled),
    );
    el.click();
  }, pattern.source);
}

// Type into the input that sits next to a label inside a form (scoped by formSel).
async function fillField(page, formSel, labelSrc, value) {
  const handle = await page.evaluateHandle(
    (f, src) => {
      const form = document.querySelector(f);
      const re = new RegExp(src, "i");
      const label = [...(form ?? document).querySelectorAll("label")].find((l) => re.test(l.textContent ?? ""));
      return label?.parentElement?.querySelector("input") ?? null;
    },
    formSel,
    labelSrc,
  );
  const el = handle.asElement();
  if (!el) throw new Error(`Field not found: ${labelSrc}`);
  await el.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
  await el.type(String(value));
}

// Choose the option whose text starts with `text` in the first select inside formSel.
async function selectOptionStartingWith(page, formSel, text) {
  const ok = await page.evaluate(
    (f, t) => {
      const selects = [...document.querySelectorAll(`${f} select`)];
      for (const sel of selects) {
        const opt = [...sel.options].find((o) => o.text.startsWith(t));
        if (opt) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
      }
      return false;
    },
    formSel,
    text,
  );
  if (!ok) throw new Error(`Option not found: ${text}`);
}

// Pick the first option with a real value in the select that sits under a matching label.
async function selectFirstOptionUnder(page, formSel, labelSrc) {
  const ok = await page.evaluate(
    (f, src) => {
      const re = new RegExp(src, "i");
      const label = [...document.querySelectorAll(`${f} label`)].find((l) => re.test(l.textContent ?? ""));
      const sel = label?.parentElement?.querySelector("select");
      const opt = sel && [...sel.options].find((o) => o.value !== "");
      if (!opt) return false;
      sel.value = opt.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    formSel,
    labelSrc,
  );
  if (!ok) throw new Error(`No selectable option under label: ${labelSrc}`);
}

async function selectPurchaseSupplier(page, name) {
  const ok = await page.evaluate((n) => {
    const sel = document.querySelector("#purchase-supplier");
    const opt = sel && [...sel.options].find((o) => o.text === n);
    if (!opt) return false;
    sel.value = opt.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, name);
  if (!ok) throw new Error(`Supplier option not found: ${name}`);
}

// Wait for a submit button to become enabled, then click and return t0.
async function clickSubmit(page, selector) {
  await page.waitForFunction((s) => {
    const b = document.querySelector(s);
    return b && !(b instanceof HTMLButtonElement && b.disabled);
  }, { timeout: TIMEOUT }, selector);
  const t0 = now();
  await page.click(selector);
  return t0;
}

// Track API calls so we can split request time from the post-save reconcile window.
function trackApi(page) {
  const posts = [];
  const ends = [];
  const starts = new Map();
  page.on("request", (req) => {
    if (req.url().includes("/api/")) starts.set(req, now());
  });
  page.on("response", (res) => {
    const req = res.request();
    if (!req.url().includes("/api/")) return;
    const end = now();
    ends.push(end);
    if (req.method() === "POST") posts.push({ url: req.url(), start: starts.get(req), end });
  });
  return { posts, ends };
}

// Wait until the modal form is gone, then the target text is visible. Returns timings.
async function measureSubmit(page, { label, t0, formSel, visibleText, baseline, tracker }) {
  await page.waitForFunction((s) => !document.querySelector(s), { timeout: TIMEOUT }, formSel);
  const feedbackMs = round(now() - t0);
  await page.waitForFunction(
    (txt, base) => {
      const n = (document.body.innerText ?? "").split(txt).length - 1;
      return n > base;
    },
    { timeout: TIMEOUT },
    visibleText,
    baseline,
  );
  const visibleMs = round(now() - t0);
  // Reconcile window: time the page kept fetching after the POST response.
  await new Promise((r) => setTimeout(r, 800));
  const post = tracker.posts[tracker.posts.length - 1];
  const apiMs = post ? round(post.end - post.start) : null;
  const lastEnd = Math.max(0, ...tracker.ends.filter((e) => post && e > post.end));
  const reconcileMs = post && lastEnd > post.end ? round(lastEnd - post.end) : 0;
  tracker.posts.length = 0;
  return { op: label, feedbackMs, visibleMs, apiMs, reconcileMs };
}

function countOf(page, text) {
  return page.evaluate((t) => (document.body.innerText ?? "").split(t).length - 1, text);
}

async function measureOpenModal(page, slug, path, pattern, formSelector) {
  await page.goto(`${BASE}/${slug}/${path}`, { waitUntil: "networkidle2" });
  const t0 = now();
  await clickByText(page, pattern);
  await page.waitForSelector(formSelector, { timeout: TIMEOUT });
  return round(now() - t0);
}

async function measureCustomerCreate(page, slug, runTag) {
  await page.goto(`${BASE}/${slug}/customers`, { waitUntil: "networkidle2" });
  const name = `PerfBrowser ${runTag} ${Date.now()}`;
  const tracker = trackApi(page);
  await clickByText(page, /add customer|new customer|\+ ?customer/);
  await page.waitForSelector('input[placeholder="e.g. Ahmed Steel Mart"]', { timeout: TIMEOUT });
  await page.type('input[placeholder="e.g. Ahmed Steel Mart"]', name);
  await page.type('input[placeholder="e.g. Bilal Gunj, Lahore"]', "PerfShop");
  await page.type('input[placeholder="e.g. 0300 1234567"]', "03000000009");
  // Submit through the modal's own form, so the page-level "Add Customer" opener is never clicked.
  const submitSel = 'form:has(input[placeholder="e.g. Ahmed Steel Mart"]) button[type="submit"]';
  await page.waitForFunction((s) => {
    const b = document.querySelector(s);
    return b && !(b instanceof HTMLButtonElement && b.disabled);
  }, { timeout: TIMEOUT }, submitSel);
  const t0 = now();
  await page.click(submitSel);
  await page.waitForFunction((n) => (document.body.innerText ?? "").includes(n), { timeout: TIMEOUT }, name);
  const visibleMs = round(now() - t0);
  const post = tracker.posts[0];
  return { visibleMs, apiMs: post ? round(post.end - post.start) : null };
}

async function measureSupplierCreate(page, slug, name, tracker) {
  await page.goto(`${BASE}/${slug}/suppliers`, { waitUntil: "networkidle2" });
  const baseline = await countOf(page, name);
  await clickByText(page, /add supplier|new supplier|\+ ?supplier/i);
  await page.waitForSelector('input[placeholder="e.g. Malik Traders"]', { timeout: TIMEOUT });
  await fillField(page, "form", "^Name", name);
  await fillField(page, "form", "^City", "PerfCity");
  await fillField(page, "form", "^Phone", "03000000008");
  const t0 = await clickSubmit(page, 'form button[type="submit"]');
  return measureSubmit(page, {
    label: "create supplier",
    t0,
    formSel: 'input[placeholder="e.g. Malik Traders"]',
    visibleText: name,
    baseline,
    tracker,
  });
}

async function measurePurchase(page, slug, supplierName, tracker) {
  await page.goto(`${BASE}/${slug}/purchases`, { waitUntil: "networkidle2" });
  await clickByText(page, /^\s*\+?\s*Add purchase\s*$/i);
  await page.waitForSelector("#new-purchase-form", { timeout: TIMEOUT });
  await selectPurchaseSupplier(page, supplierName);
  await selectFirstOptionUnder(page, "#new-purchase-form", "^Product");
  await selectFirstOptionUnder(page, "#new-purchase-form", "^Size");
  await selectFirstOptionUnder(page, "#new-purchase-form", "^Grade");
  await fillField(page, "#new-purchase-form", "^Qty", 5);
  await fillField(page, "#new-purchase-form", "^Buying price", 100);
  await fillField(page, "#new-purchase-form", "^Selling price", 150);
  const t0 = await clickSubmit(page, 'button[form="new-purchase-form"]');
  return measureSubmit(page, {
    label: "submit purchase",
    t0,
    formSel: "#new-purchase-form",
    visibleText: supplierName,
    baseline: 0,
    tracker,
  });
}

async function measurePayment(page, slug, supplierName, tracker) {
  await page.goto(`${BASE}/${slug}/purchases`, { waitUntil: "networkidle2" });
  // Open the first purchase row for this supplier, which opens the payment dialog.
  // Row click does not open the pay dialog, so open details from the row menu, then "Pay due".
  await page.waitForFunction(
    (n) =>
      [...document.querySelectorAll("[role=button]")].some(
        (el) => (el.textContent ?? "").includes(n) && el.offsetParent !== null,
      ),
    { timeout: TIMEOUT },
    supplierName,
  );
  await page.evaluate((n) => {
    const row = [...document.querySelectorAll("[role=button]")].find(
      (el) => (el.textContent ?? "").includes(n) && el.offsetParent !== null,
    );
    row.querySelector('button[aria-haspopup="menu"]').click();
  }, supplierName);
  await page.waitForFunction(() => [...document.querySelectorAll('[role="menuitem"]')].some((m) => m.textContent?.trim() === "View details"), { timeout: TIMEOUT });
  await page.evaluate(() => {
    [...document.querySelectorAll('[role="menuitem"]')].find((m) => m.textContent?.trim() === "View details").click();
  });
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => /^\s*Pay due/.test(b.textContent ?? "") && !b.disabled),
    { timeout: TIMEOUT },
  );
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => /^\s*Pay due/.test(b.textContent ?? "")).click();
  });
  await page.waitForSelector("#pay-supplier-amount", { timeout: TIMEOUT });
  await page.click("#pay-supplier-amount", { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type("#pay-supplier-amount", "10");
  const t0 = await clickSubmit(page, 'button[form="pay-supplier-form"]');
  await page.waitForFunction(() => !document.querySelector("#pay-supplier-form"), { timeout: TIMEOUT });
  const feedbackMs = round(now() - t0);
  await new Promise((r) => setTimeout(r, 800));
  const post = tracker.posts[tracker.posts.length - 1];
  const apiMs = post ? round(post.end - post.start) : null;
  tracker.posts.length = 0;
  return { op: "record payment", feedbackMs, visibleMs: null, apiMs, reconcileMs: null };
}

async function measureSale(page, slug, tracker) {
  await page.goto(`${BASE}/${slug}/sales`, { waitUntil: "networkidle2" });
  const baseline = await countOf(page, CUSTOMER_PREFIX);
  await clickByText(page, /\+ New Sale/);
  await page.waitForSelector("#new-sale-form", { timeout: TIMEOUT });
  await selectOptionStartingWith(page, "#new-sale-form", CUSTOMER_PREFIX);
  await fillField(page, "#new-sale-form", "^Qty", 1);
  await clickByText(page, /^\s*Add item\s*$/i);
  const t0 = await clickSubmit(page, 'button[form="new-sale-form"]');
  return measureSubmit(page, {
    label: "submit sale",
    t0,
    formSel: "#new-sale-form",
    visibleText: CUSTOMER_PREFIX,
    baseline,
    tracker,
  });
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  page.setDefaultTimeout(TIMEOUT);
  // Read-only guard: without WRITES=1 every non-GET API call (except login) is aborted and counted.
  const requestCounts = { api: 0, mutations: 0, blockedMutations: 0 };
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const method = req.method();
    // OPTIONS is the CORS preflight. It does not change data, so it is allowed.
    const isGet = method === "GET" || method === "HEAD" || method === "OPTIONS";
    if (req.url().includes("/api/")) requestCounts.api += 1;
    if (isGet) return req.continue();
    // Login is the only non-GET call allowed in read-only mode (form POST to /login).
    const isLogin = new URL(req.url()).pathname.endsWith("/login");
    if (isLogin) return req.continue();
    requestCounts.mutations += 1;
    if (!WRITES) {
      requestCounts.blockedMutations += 1;
      return req.abort();
    }
    return req.continue();
  });
  const slug = await login(page);

  // First pass is a cold compile/hydration warm-up. It is reported separately.
  const cold = { sale: await measureOpenModal(page, slug, "sales", /\+ New Sale/, "#new-sale-form") };
  console.log("COLD", JSON.stringify(cold));

  const rows = [];
  for (let i = 1; i <= RUNS; i++) {
    const sale = await measureOpenModal(page, slug, "sales", /\+ New Sale/, "#new-sale-form");
    await page.keyboard.press("Escape");
    const purchase = await measureOpenModal(page, slug, "purchases", /Add purchase|\+ ?Add/i, "#new-purchase-form");
    await page.keyboard.press("Escape");
    // Customer create writes a record, so it runs only when WRITES=1.
    const customer = WRITES
      ? await measureCustomerCreate(page, slug, `r${i}`)
      : { visibleMs: null, apiMs: null };
    rows.push({ run: i, openSaleMs: sale, openPurchaseMs: purchase, customerVisibleMs: customer.visibleMs, customerApiMs: customer.apiMs });
  }
  console.table(rows);

  if (WRITES) {
    const writes = [];
    for (let i = 1; i <= RUNS; i++) {
      const tracker = trackApi(page);
      const supplierName = `PerfBrowser sup r${i} ${Date.now()}`;
      const record = (row) => {
        writes.push({ run: i, ...row });
        console.log("WRITE", JSON.stringify({ run: i, ...row }));
      };
      record(await measureSupplierCreate(page, slug, supplierName, tracker));
      tracker.posts.length = 0;
      record(await measurePurchase(page, slug, supplierName, trackApi(page)));
      record(await measurePayment(page, slug, supplierName, trackApi(page)));
      record(await measureSale(page, slug, trackApi(page)));
    }
    console.table(writes);
  }
  const readOnlyProven = !WRITES && requestCounts.mutations === 0;
  console.log("REQUESTS", JSON.stringify({ writesEnabled: WRITES, ...requestCounts, readOnlyProven }));
  if (!WRITES && requestCounts.mutations > 0) {
    console.error("FAIL: read-only run sent mutation requests.");
    process.exitCode = 1;
  }
} catch (e) {
  console.error(`FAIL: ${String(e.message).split("\n")[0].slice(0, 200)}. Check selectors, login and the app is on BASE_URL.`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
