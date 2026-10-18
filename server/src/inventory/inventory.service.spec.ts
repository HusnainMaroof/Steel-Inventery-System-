import { Prisma, type Purchase, type PurchaseLine } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService, purchaseLotRows, unitSafeProductStock } from "./inventory.service";

const line = (over: Record<string, unknown> = {}) =>
  ({
    id: "line-1",
    productId: "steel",
    variantId: null,
    item: "Rod",
    productName: "Steel rod",
    spec: null,
    quality: null,
    unit: "kg",
    qty: new Prisma.Decimal(15),
    rate: new Prisma.Decimal(100),
    sellRate: null,
    categoryId: null,
    attributeSnapshot: null,
    lotNumber: "LOT-A",
    heatNumber: null,
    batchNumber: null,
    warehouseId: null,
    locationId: null,
    ...over,
  }) as unknown as PurchaseLine;

const purchase = (lines: PurchaseLine[], over: Record<string, unknown> = {}) =>
  ({
    id: "purchase-1",
    businessId: "business-1",
    supplierId: "supplier-1",
    date: new Date("2026-10-01"),
    transport: new Prisma.Decimal(0),
    loading: new Prisma.Decimal(0),
    labour: new Prisma.Decimal(0),
    otherCost: new Prisma.Decimal(0),
    supplier: { name: "Husna Steel" },
    lines,
    ...over,
  }) as unknown as Purchase & { supplier: { name: string }; lines: PurchaseLine[] };

const sold = (entries: [string, string | number][]) =>
  new Map(entries.map(([key, qty]) => [key, new Prisma.Decimal(qty)]));

describe("purchaseLotRows: unique lines", () => {
  it("subtracts sold qty from a single line (15 received, 3 sold = 12)", () => {
    const rows = purchaseLotRows(
      purchase([line()]),
      sold([["purchase-1:steel:", 3]]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      purchaseLineId: "line-1",
      purchaseLineIds: ["line-1"],
      ambiguous: false,
      remainingQty: 12,
      lotNumber: "LOT-A",
    });
  });

  it("drops a fully sold line", () => {
    const rows = purchaseLotRows(
      purchase([line()]),
      sold([["purchase-1:steel:", 15]]),
    );
    expect(rows).toEqual([]);
  });

  it("clamps an oversale at zero instead of going negative", () => {
    const rows = purchaseLotRows(
      purchase([line()]),
      sold([["purchase-1:steel:", 20]]),
    );
    expect(rows).toEqual([]);
  });

  it("keeps lines with different variants separate", () => {
    const rows = purchaseLotRows(
      purchase([
        line({ id: "plain", variantId: null, qty: new Prisma.Decimal(10) }),
        line({ id: "variant", variantId: "v-12", qty: new Prisma.Decimal(4) }),
      ]),
      sold([["purchase-1:steel:v-12", 1]]),
    );
    expect(rows.map((row) => [row.purchaseLineId, row.ambiguous, row.remainingQty])).toEqual([
      ["plain", false, 10],
      ["variant", false, 3],
    ]);
  });
});

describe("purchaseLotRows: duplicate purchase/product/variant lines", () => {
  const duplicates = () =>
    purchase([
      line({ id: "dup-a", qty: new Prisma.Decimal(10), rate: new Prisma.Decimal(100), lotNumber: "LOT-A" }),
      line({ id: "dup-b", qty: new Prisma.Decimal(5), rate: new Prisma.Decimal(100), lotNumber: "LOT-B" }),
    ]);

  it("returns one ambiguous group row with the group remaining, not per-line values", () => {
    const rows = purchaseLotRows(duplicates(), sold([["purchase-1:steel:", 3]]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ambiguous: true,
      remainingQty: 12,
      purchaseLineIds: ["dup-a", "dup-b"],
    });
  });

  it("does not subtract the sold qty from each duplicate line", () => {
    const rows = purchaseLotRows(duplicates(), sold([["purchase-1:steel:", 3]]));
    const total = rows.reduce((sum, row) => sum + row.remainingQty, 0);
    expect(total).toBe(12);
    expect(total).not.toBe(9);
  });

  it("hides lot-specific fields and per-line ids for the ambiguous group", () => {
    const [row] = purchaseLotRows(duplicates(), sold([]));
    expect(row.purchaseLineId).toBeUndefined();
    expect(row.lotNumber).toBeUndefined();
    expect(row.sellPrice).toBeUndefined();
  });

  it("averages landed cost across the group, including charges", () => {
    // Goods 10*100 + 5*100 = 1500, charges 300 → (1500 + 300) / 15 = 120
    const withCharges = purchase(duplicates().lines, {
      transport: new Prisma.Decimal(300),
    });
    const [row] = purchaseLotRows(withCharges, sold([]));
    expect(row.landedPerUnit).toBe(120);
  });

  it("partial sale across duplicates keeps a positive group remaining", () => {
    const rows = purchaseLotRows(duplicates(), sold([["purchase-1:steel:", 14]]));
    expect(rows[0].remainingQty).toBe(1);
  });

  it("drops the ambiguous group once the group is fully sold", () => {
    expect(purchaseLotRows(duplicates(), sold([["purchase-1:steel:", 15]]))).toEqual([]);
  });

  it("flags an oversale across duplicates and clamps to zero", () => {
    expect(purchaseLotRows(duplicates(), sold([["purchase-1:steel:", 18]]))).toEqual([]);
  });

  it("uses net sold qty when a sale is reduced (returns are modelled as a smaller sale line)", () => {
    // The API has no negative sale lines and no returns table. A reduced sale is
    // stored as a smaller SaleLine, so the group consumption already reflects the return.
    const rows = purchaseLotRows(duplicates(), sold([["purchase-1:steel:", 2]]));
    expect(rows[0].remainingQty).toBe(13);
  });
});

describe("unitSafeProductStock: mixed units and grouping", () => {
  const products = [
    { id: "p-bag", name: "Cement", unit: "bag" },
    { id: "p-steel", name: "Steel", unit: "kg" },
  ];
  // unitSafeProductStock returns one row per product, so pick the one under test.
  const rowFor = (productId: string, rows: Parameters<typeof unitSafeProductStock>[1]) => {
    const found = unitSafeProductStock(products, rows).find((r) => r.productId === productId);
    if (!found) throw new Error(`no row for ${productId}`);
    return found;
  };

  it("1. keeps mixed units separate and returns no single quantity", () => {
    const [row] = unitSafeProductStock(products, [
      { productId: "p-bag", unit: "bag", _sum: { qty: new Prisma.Decimal(7) } },
      { productId: "p-bag", unit: "kg", _sum: { qty: new Prisma.Decimal(0) } },
    ]);
    expect(row.mixedUnits).toBe(true);
    expect(row.qty).toBeNull();
    expect(row.unit).toBeNull();
    expect(row.units).toEqual([
      { unit: "bag", qty: expect.any(Prisma.Decimal) },
      { unit: "kg", qty: expect.any(Prisma.Decimal) },
    ]);
    expect(row.units.find((u) => u.unit === "bag")?.qty.toNumber()).toBe(7);
    expect(row.units.find((u) => u.unit === "kg")?.qty.toNumber()).toBe(0);
  });

  it("2. adds the same unit: 3 kg + 4 kg = 7 kg", () => {
    const row = rowFor("p-steel", [
      { productId: "p-steel", unit: "kg", _sum: { qty: new Prisma.Decimal(3) } },
      { productId: "p-steel", unit: "kg", _sum: { qty: new Prisma.Decimal(4) } },
    ]);
    expect(row.mixedUnits).toBe(false);
    expect(row.unit).toBe("kg");
    expect(row.qty?.toNumber()).toBe(7);
  });

  it("3. keeps different products independent", () => {
    const rows = unitSafeProductStock(products, [
      { productId: "p-bag", unit: "bag", _sum: { qty: new Prisma.Decimal(5) } },
      { productId: "p-steel", unit: "kg", _sum: { qty: new Prisma.Decimal(2) } },
    ]);
    expect(rows.find((r) => r.productId === "p-bag")?.qty?.toNumber()).toBe(5);
    expect(rows.find((r) => r.productId === "p-steel")?.qty?.toNumber()).toBe(2);
  });

  it("6. exact Decimal: 0.125 kg + 0.375 kg = 0.500 kg", () => {
    const row = rowFor("p-steel", [
      { productId: "p-steel", unit: "kg", _sum: { qty: new Prisma.Decimal("0.125") } },
      { productId: "p-steel", unit: "kg", _sum: { qty: new Prisma.Decimal("0.375") } },
    ]);
    expect(row.qty?.toString()).toBe("0.5");
    expect(row.qty?.toFixed(3)).toBe("0.500");
  });

  it("7. signed ledger rows (purchase, sale, sale delete, reversal) net within product and unit", () => {
    const row = rowFor("p-steel", [
      { productId: "p-steel", unit: "kg", _sum: { qty: new Prisma.Decimal("10.7") } },
      { productId: "p-steel", unit: "kg", _sum: { qty: new Prisma.Decimal("-2.5") } },
      { productId: "p-steel", unit: "kg", _sum: { qty: new Prisma.Decimal("1") } },
    ]);
    expect(row.qty?.toFixed(3)).toBe("9.200");
  });

  it("8. product with no ledger rows reports zero in its own unit", () => {
    const row = rowFor("p-steel", []);
    expect(row).toMatchObject({ productId: "p-steel", unit: "kg", qty: 0, mixedUnits: false, units: [] });
  });

  it("keeps a zero balance in a single unit as zero, not mixed", () => {
    const row = rowFor("p-steel", [
      { productId: "p-steel", unit: "kg", _sum: { qty: new Prisma.Decimal(0) } },
    ]);
    expect(row.mixedUnits).toBe(false);
    expect(row.qty?.toNumber()).toBe(0);
  });

  it("does not invent a conversion between bag and kg", () => {
    const row = rowFor("p-bag", [
      { productId: "p-bag", unit: "bag", _sum: { qty: new Prisma.Decimal(7) } },
      { productId: "p-bag", unit: "kg", _sum: { qty: new Prisma.Decimal(50) } },
    ]);
    expect(row.qty).toBeNull();
    expect(row.units.map((u) => u.qty.toNumber()).sort((a, b) => a - b)).toEqual([7, 50]);
  });
});

describe("InventoryService stock queries (mocked prisma)", () => {
  const productRows = [{ id: "steel", name: "Steel", unit: "kg" }];

  it("5. scopes stock reads to the calling business (no cross-tenant sums)", async () => {
    const prisma = {
      inventoryTransaction: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      product: { findMany: jest.fn().mockResolvedValue(productRows) },
    };
    const service = new InventoryService(prisma as unknown as PrismaService);
    await service.stock("business-A");
    expect(prisma.inventoryTransaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ["productId", "unit"], where: { businessId: "business-A" } }),
    );
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: "business-A", active: true } }),
    );
  });

  it("1+2. stock() returns mixed-unit product without a summed qty", async () => {
    const prisma = {
      inventoryTransaction: {
        groupBy: jest.fn().mockResolvedValue([
          { productId: "steel", unit: "bag", _sum: { qty: new Prisma.Decimal(7) } },
          { productId: "steel", unit: "kg", _sum: { qty: new Prisma.Decimal(0) } },
        ]),
      },
      product: { findMany: jest.fn().mockResolvedValue(productRows) },
    };
    const service = new InventoryService(prisma as unknown as PrismaService);
    const [row] = await service.stock("business-A");
    expect(row).toMatchObject({ productId: "steel", qty: null, unit: null, mixedUnits: true });
    expect(row.units).toHaveLength(2);
  });

  it("4. stockByVariant keeps variants and units separate (no parent sum)", async () => {
    const prisma = {
      inventoryTransaction: {
        groupBy: jest.fn().mockResolvedValue([
          { productId: "steel", categoryId: null, variantId: "v1", unit: "kg", _sum: { qty: new Prisma.Decimal(3) } },
          { productId: "steel", categoryId: null, variantId: "v2", unit: "kg", _sum: { qty: new Prisma.Decimal(4) } },
          { productId: "steel", categoryId: null, variantId: "v2", unit: "bag", _sum: { qty: new Prisma.Decimal(1) } },
        ]),
      },
      product: { findMany: jest.fn().mockResolvedValue(productRows) },
      productCategory: { findMany: jest.fn().mockResolvedValue([]) },
      variant: {
        findMany: jest.fn().mockResolvedValue([
          { id: "v1", shortName: "V1", attributes: null },
          { id: "v2", shortName: "V2", attributes: null },
        ]),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const service = new InventoryService(prisma as unknown as PrismaService);
    const rows = await service.stockByVariant("business-A");
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => [r.variantId, r.unit, r.stockQty.toNumber()])).toEqual([
      ["v1", "kg", 3],
      ["v2", "kg", 4],
      ["v2", "bag", 1],
    ]);
  });
});

describe("InventoryService.lots (mocked prisma)", () => {
  it("applies the group rule to the purchases it reads", async () => {
    const prisma = {
      purchase: {
        findMany: jest.fn().mockResolvedValue([
          purchase([
            line({ id: "dup-a", qty: new Prisma.Decimal(10) }),
            line({ id: "dup-b", qty: new Prisma.Decimal(5) }),
          ]),
        ]),
      },
      saleLine: {
        groupBy: jest.fn().mockResolvedValue([
          { purchaseId: "purchase-1", productId: "steel", variantId: null, _sum: { qty: new Prisma.Decimal(3) } },
        ]),
      },
    };
    const service = new InventoryService(prisma as unknown as PrismaService);

    const rows = await service.lots("business-1", 0, 20);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ambiguous: true, remainingQty: 12 });
    expect(prisma.saleLine.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sale: { businessId: "business-1" }, purchaseId: { in: ["purchase-1"] } } }),
    );
  });
});
