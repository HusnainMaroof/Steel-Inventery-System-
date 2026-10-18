import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCoalescedRefresh } from "./refresh-coalesce.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("createCoalescedRefresh", () => {
  it("runs one request for concurrent calls", async () => {
    let runs = 0;
    const gate = deferred();
    const refresh = createCoalescedRefresh(() => {
      runs += 1;
      return gate.promise;
    });

    const first = refresh();
    const second = refresh();
    gate.resolve();
    await Promise.all([first, second]);

    assert.equal(runs, 1);
  });

  it("runs again after the previous request finished", async () => {
    let runs = 0;
    const refresh = createCoalescedRefresh(async () => {
      runs += 1;
    });

    await refresh();
    await refresh();
    assert.equal(runs, 2);
  });

  it("clears the in-flight slot when the request fails", async () => {
    let runs = 0;
    const refresh = createCoalescedRefresh(async () => {
      runs += 1;
      if (runs === 1) throw new Error("network");
    });

    await assert.rejects(refresh(), /network/);
    await refresh();
    assert.equal(runs, 2);
  });
});
