// Fails CI when the DB-backed E2E suites were skipped or did not pass.
// Usage: node scripts/assert-db-suites-ran.cjs jest-results.json
const fs = require("fs");

const REQUIRED = [
  "stock-lot.e2e-spec.ts",
  "purchase-delete.e2e-spec.ts",
  "inventory-quantity.e2e-spec.ts",
  "stock-concurrency.e2e-spec.ts",
];

const file = process.argv[2];
if (!file) {
  console.error("usage: assert-db-suites-ran.cjs <jest-json>");
  process.exit(2);
}

const report = JSON.parse(fs.readFileSync(file, "utf8"));
let failed = false;

for (const name of REQUIRED) {
  const suite = report.testResults.find((r) => r.name.replace(/\\/g, "/").endsWith(`/test/${name}`));
  if (!suite) {
    console.error(`MISSING: ${name} did not run`);
    failed = true;
    continue;
  }
  const tests = suite.assertionResults;
  const notPassed = tests.filter((t) => t.status !== "passed");
  if (suite.status !== "passed" || tests.length === 0 || notPassed.length > 0) {
    console.error(`NOT PASSED: ${name} status=${suite.status} tests=${tests.length} notPassed=${notPassed.length}`);
    failed = true;
    continue;
  }
  console.log(`OK: ${name} ran ${tests.length} tests, all passed`);
}

process.exit(failed ? 1 : 0);
