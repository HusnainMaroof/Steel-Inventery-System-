import { CatalogueCache } from "./catalogue-cache";

describe("CatalogueCache", () => {
  it("returns null on miss and the stored payload on hit", () => {
    const cache = new CatalogueCache();
    expect(cache.get("biz-1")).toBeNull();

    cache.set("biz-1", { products: [{ id: "p1" }], settings: {} } as never);
    expect(cache.get("biz-1")?.products).toEqual([{ id: "p1" }]);
  });

  it("invalidate drops the entry synchronously", () => {
    const cache = new CatalogueCache();
    cache.set("biz-1", { products: [], settings: {} } as never);
    cache.invalidate("biz-1");
    expect(cache.get("biz-1")).toBeNull();
  });

  it("invalidating one business leaves others cached", () => {
    const cache = new CatalogueCache();
    cache.set("biz-1", { products: [], settings: {} } as never);
    cache.set("biz-2", { products: [], settings: {} } as never);
    cache.invalidate("biz-1");
    expect(cache.get("biz-1")).toBeNull();
    expect(cache.get("biz-2")).not.toBeNull();
  });

  it("evicts the oldest entry beyond the capacity cap", () => {
    const cache = new CatalogueCache();
    // Fill beyond MAX_CACHED_BUSINESSES (500).
    for (let i = 0; i < 501; i++) {
      cache.set(`biz-${i}`, { products: [], settings: {} } as never);
    }
    expect(cache.get("biz-0")).toBeNull();
    expect(cache.get("biz-500")).not.toBeNull();
  });
});
