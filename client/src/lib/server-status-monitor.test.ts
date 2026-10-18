import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createStatusCheck, STATUS_CHECK_MIN_INTERVAL_MS } from "./server-status-monitor.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("createStatusCheck", () => {
  it("shares one in-flight probe between concurrent triggers", async () => {
    let probes = 0;
    const gate = deferred<boolean>();
    const check = createStatusCheck({
      probe: () => {
        probes += 1;
        return gate.promise;
      },
      onUnavailable: () => assert.fail("should not report unavailable"),
      now: () => 0,
    });

    const first = check();
    const second = check();
    const third = check();
    gate.resolve(true);
    await Promise.all([first, second, third]);

    assert.equal(probes, 1);
  });

  it("does not report unavailable when the server answers", async () => {
    let unavailable = 0;
    const check = createStatusCheck({
      probe: async () => true,
      onUnavailable: () => {
        unavailable += 1;
      },
      now: () => 0,
    });
    await check();
    assert.equal(unavailable, 0);
  });

  it("reports unavailable when the probe fails", async () => {
    let unavailable = 0;
    const check = createStatusCheck({
      probe: async () => false,
      onUnavailable: () => {
        unavailable += 1;
      },
      now: () => 0,
    });
    await check();
    assert.equal(unavailable, 1);
  });

  it("skips a repeat trigger inside the minimum interval", async () => {
    let probes = 0;
    let clock = 1_000;
    const check = createStatusCheck({
      probe: async () => {
        probes += 1;
        return true;
      },
      onUnavailable: () => undefined,
      now: () => clock,
    });

    await check();
    clock += STATUS_CHECK_MIN_INTERVAL_MS - 1;
    await check();
    assert.equal(probes, 1);
  });

  it("probes again once the minimum interval has passed", async () => {
    let probes = 0;
    let clock = 1_000;
    const check = createStatusCheck({
      probe: async () => {
        probes += 1;
        return true;
      },
      onUnavailable: () => undefined,
      now: () => clock,
    });

    await check();
    clock += STATUS_CHECK_MIN_INTERVAL_MS;
    await check();
    assert.equal(probes, 2);
  });

  it("clears the in-flight slot so a later check can run after failure", async () => {
    let probes = 0;
    let clock = 0;
    const check = createStatusCheck({
      probe: async () => {
        probes += 1;
        return false;
      },
      onUnavailable: () => undefined,
      now: () => clock,
    });

    await check();
    clock += STATUS_CHECK_MIN_INTERVAL_MS;
    await check();
    assert.equal(probes, 2);
  });
});
