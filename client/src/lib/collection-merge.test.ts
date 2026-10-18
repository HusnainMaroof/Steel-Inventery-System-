import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  commitThenReconcile,
  createSequenceGuard,
  createWriteLog,
  overlayWrites,
  upsertById,
} from "./collection-merge.ts";

type Row = { id: string; name: string };

describe("upsertById", () => {
  it("inserts a record whose id is new", () => {
    const list: Row[] = [{ id: "a", name: "A" }];
    const next = upsertById(list, { id: "b", name: "B" });
    assert.deepEqual(next, [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ]);
  });

  it("replaces an existing record without mutating the input array", () => {
    const original: Row = { id: "a", name: "old" };
    const list: Row[] = [original, { id: "b", name: "B" }];
    const next = upsertById(list, { id: "a", name: "new" });

    assert.deepEqual(next, [
      { id: "a", name: "new" },
      { id: "b", name: "B" },
    ]);
    // Input is untouched.
    assert.equal(list[0], original);
    assert.equal(list[0].name, "old");
    assert.equal(list.length, 2);
    // Other rows keep their identity.
    assert.equal(next[1], list[1]);
  });
});

describe("write log overlay (refresh vs. create race)", () => {
  it("keeps a customer created while a refresh was in flight", () => {
    const log = createWriteLog();
    const customers: Row[] = [{ id: "c1", name: "Existing" }];

    // Refresh starts, reads the server before the create commits.
    const startGen = log.generation();
    const staleResponse: Row[] = [...customers];

    // Create commits and the response is merged locally.
    const created: Row = { id: "c2", name: "New" };
    log.record("customers", created);

    // The stale refresh resolves afterwards.
    const applied = overlayWrites(staleResponse, log.since(startGen, "customers"));
    assert.deepEqual(applied.map((c) => c.id), ["c1", "c2"]);
  });

  it("keeps a supplier created while a refresh was in flight", () => {
    const log = createWriteLog();
    const startGen = log.generation();
    log.record("suppliers", { id: "s1", name: "Supplier" });
    const applied = overlayWrites<Row>([], log.since(startGen, "suppliers"));
    assert.deepEqual(applied, [{ id: "s1", name: "Supplier" }]);
  });

  it("does not re-apply writes that were already in the response", () => {
    const log = createWriteLog();
    log.record("customers", { id: "c2", name: "Old write" });
    // A fetch that starts after the write already contains it on the server.
    const startGen = log.generation();
    const fresh: Row[] = [{ id: "c2", name: "Server" }];
    const applied = overlayWrites(fresh, log.since(startGen, "customers"));
    assert.deepEqual(applied, [{ id: "c2", name: "Server" }]);
  });

  it("filters writes by collection", () => {
    const log = createWriteLog();
    const startGen = log.generation();
    log.record("variants", { id: "v1", name: "Variant" });
    assert.deepEqual(log.since(startGen, "customers"), []);
    assert.deepEqual(log.since(startGen, "variants"), [{ id: "v1", name: "Variant" }]);
  });

  it("keeps inventory-related rows intact when a variant is merged", () => {
    const log = createWriteLog();
    const variants: Row[] = [
      { id: "v1", name: "Bolt" },
      { id: "v2", name: "Nut" },
    ];
    const startGen = log.generation();
    const created: Row = { id: "v3", name: "Washer" };
    log.record("variants", created);
    const merged = upsertById(variants, created);

    // Existing rows are unchanged, and only the new row is appended.
    assert.deepEqual(merged.slice(0, 2), variants);
    assert.equal(merged.length, 3);
    assert.deepEqual(log.since(startGen, "variants"), [created]);
  });

  it("clear drops recorded writes", () => {
    const log = createWriteLog();
    log.record("customers", { id: "c1", name: "X" });
    log.clear();
    assert.deepEqual(log.since(0, "customers"), []);
  });
});

describe("sequence guard (stale transaction responses)", () => {
  it("only the most recently started request is latest", () => {
    const guard = createSequenceGuard();
    const first = guard.start();
    const second = guard.start();
    assert.equal(guard.isLatest(first), false);
    assert.equal(guard.isLatest(second), true);
  });

  it("a stale response is dropped even if it resolves last", () => {
    const guard = createSequenceGuard();
    const older = guard.start();
    const newer = guard.start();
    // Newer resolves first and applies.
    assert.equal(guard.isLatest(newer), true);
    // Older resolves later and must not apply.
    assert.equal(guard.isLatest(older), false);
  });
});

describe("commitThenReconcile", () => {
  it("does not run reconcile and throws when the write fails", async () => {
    let reconciled = false;
    let reported = false;
    await assert.rejects(
      commitThenReconcile(
        async () => {
          throw new Error("Invalid payload");
        },
        async () => {
          reconciled = true;
        },
        () => {
          reported = true;
        },
      ),
      /Invalid payload/,
    );
    assert.equal(reconciled, false);
    assert.equal(reported, false);
  });

  it("runs reconcile after a successful write and returns the result", async () => {
    let reconciled = false;
    const result = await commitThenReconcile(
      async () => "created-1",
      async () => {
        reconciled = true;
      },
      () => assert.fail("no error expected"),
    );
    assert.equal(result, "created-1");
    assert.equal(reconciled, true);
  });

  it("reports a reconcile failure without failing the committed write", async () => {
    const reconcileError = new Error("refresh timed out");
    const reported: unknown[] = [];
    const result = await commitThenReconcile(
      async () => "sale-9",
      async () => {
        throw reconcileError;
      },
      (reason) => reported.push(reason),
    );
    assert.equal(result, "sale-9");
    assert.deepEqual(reported, [reconcileError]);
  });

  it("failed write leaves caller-held state untouched", async () => {
    let state: Row[] = [{ id: "c1", name: "Existing" }];
    // Same shape as store code: local merge runs only after the write resolves.
    const createCustomer = async () => {
      const row = await commitThenReconcile(
        async (): Promise<Row> => {
          throw new Error("Server rejected customer");
        },
        async () => undefined,
        () => undefined,
      );
      state = upsertById(state, row);
    };
    await assert.rejects(createCustomer, /Server rejected customer/);
    assert.deepEqual(state, [{ id: "c1", name: "Existing" }]);
  });
});
