import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Safety net for the bootstrap catalogue cache: every service method that
 * performs a Prisma write to a cached table MUST also invalidate the cache
 * for its business. This test enumerates the methods by reading the source,
 * so mutation #24 added next year cannot silently serve stale catalogue data.
 *
 * If this test fails on a new method, either add
 * `this.catalogue.invalidate(businessId)` (products/warehouses) or
 * `this.catalogueCache.invalidate(businessId)` (ledger) after the write.
 *
 * KNOWN LIMITATION: this is static source inspection, not execution. It
 * checks that a method *containing* a write also *contains* an invalidate
 * call — it does not follow call graphs, so it cannot prove the invalidation
 * actually executes on every code path (early throws, conditionals, or a
 * write moved into a private helper invoked by a public method can still
 * evade it in either direction). CI green here means "no naked writes are
 * textually visible", not "every future mutation is provably covered".
 * A runtime test spying on the cache would be strictly stronger if the
 * tradeoff is ever revisited.
 */

const WRITE_OP =
  /this\.prisma\.\w+\.(?:create|createMany|update|updateMany|delete|deleteMany|upsert)\(/;
const INVALIDATE = /this\.(?:catalogue|catalogueCache)\.invalidate(?:Business)?\(/;

const SOURCES: Array<[string, string]> = [
  ["products.service.ts", join(__dirname, "../products/products.service.ts")],
  ["warehouses.service.ts", join(__dirname, "../warehouses/warehouses.service.ts")],
  ["ledger.service.ts", join(__dirname, "ledger.service.ts")],
];

function methodBodies(source: string): Array<{ name: string; body: string }> {
  const starts = [
    ...source.matchAll(/^  (?:private )?(?:async )?(\w+)\(/gm),
  ].map((m) => ({ name: m[1], index: m.index ?? 0 }));
  return starts.map((start, i) => ({
    name: start.name,
    body: source.slice(
      start.index,
      i + 1 < starts.length ? starts[i + 1].index : undefined,
    ),
  }));
}

describe("catalogue cache invalidation coverage", () => {
  for (const [label, path] of SOURCES) {
    it(`${label}: every write method invalidates the catalogue cache`, () => {
      const source = readFileSync(path, "utf8");
      const offenders = methodBodies(source)
        .filter(({ body }) => WRITE_OP.test(body) && !INVALIDATE.test(body))
        .map(({ name }) => name);

      expect(offenders).toEqual([]);
    });
  }

  it("matches the write operations the cached tables actually have", () => {
    // Guard the guard: if these counts hit zero the regexes above broke
    // (renamed fields, refactor) and the enumeration is silently vacuous.
    const products = readFileSync(SOURCES[0][1], "utf8");
    const warehouses = readFileSync(SOURCES[1][1], "utf8");
    const ledger = readFileSync(SOURCES[2][1], "utf8");
    const writeMethods = [products, warehouses, ledger]
      .flatMap((s) => methodBodies(s))
      .filter(({ body }) => WRITE_OP.test(body));
    expect(writeMethods.length).toBeGreaterThanOrEqual(20);
    expect(writeMethods.map(({ name }) => name)).toContain("create");
    expect(writeMethods.map(({ name }) => name)).toContain("removeVariant");
    expect(writeMethods.map(({ name }) => name)).toContain("savePreferences");
  });
});
