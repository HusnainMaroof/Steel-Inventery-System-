import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PurchasesService, planPurchaseLineChanges, replacementStockShortage } from "./purchases.service";
import { UpdatePurchaseLineDto } from "./dto/update-purchase.dto";

describe("purchase payment history safety", () => {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    purchase: { findFirst: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((operation: (transaction: typeof tx) => unknown) =>
      operation(tx),
    ),
  };
  const service = new PurchasesService(
    prisma as unknown as PrismaService,
    { logTx: jest.fn() } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tx.$executeRaw.mockResolvedValue(1);
  });

  it("does not allow purchase paid totals to be edited outside payments", async () => {
    const purchase = {
      id: "purchase-1",
      supplierId: "supplier-1",
      paid: new Prisma.Decimal("25.00"),
      lines: [],
    };
    tx.purchase.findFirst.mockResolvedValue(purchase);

    await expect(
      service.update("business-1", "purchase-1", { paid: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("purchase stock safety", () => {
  it("rejects deleting receipts that existing sales depend on", () => {
    expect(
      replacementStockShortage(
        [{ productId: "steel", qty: -25 }],
        [],
      ),
    ).toBe("steel");
  });

  it("accepts a reduced receipt when remaining stock stays non-negative", () => {
    expect(
      replacementStockShortage(
        [{ productId: "steel", qty: -25 }],
        [{ productId: "steel", qty: 25 }],
      ),
    ).toBeUndefined();
  });

  it("combines replacement lines for the same product", () => {
    expect(
      replacementStockShortage(
        [{ productId: "cement", qty: -10 }],
        [
          { productId: "cement", qty: 4 },
          { productId: "cement", qty: 5 },
        ],
      ),
    ).toBe("cement");
  });

  it("handles Prisma-compatible numeric values after conversion", () => {
    expect(Number(new Prisma.Decimal("12.500"))).toBe(12.5);
  });
});

describe("purchase deletion ledger reversal", () => {
  const tx = {
    $executeRaw: jest.fn(),
    purchase: { findFirst: jest.fn(), delete: jest.fn() },
    saleLine: { count: jest.fn() },
    payment: { findFirst: jest.fn() },
    inventoryTransaction: {
      groupBy: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    stockLot: { updateMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((operation: (t: typeof tx) => unknown) =>
      operation(tx),
    ),
  };
  const audit = { logTx: jest.fn() };
  const service = new PurchasesService(
    prisma as unknown as PrismaService,
    audit as never,
  );

  const purchase = {
    id: "purchase-1",
    supplierId: "supplier-1",
    paid: new Prisma.Decimal("0"),
    lines: [{ productId: "product-1" }],
  };
  const originals = [
    {
      productId: "product-1",
      categoryId: null,
      variantId: null,
      warehouseId: null,
      locationId: null,
      attributeSnapshot: null,
      unit: "kg",
      refLabel: "LOT-1",
      purchaseLineId: "line-1",
      lotId: "lot-1",
      qty: new Prisma.Decimal("10.500"),
      date: new Date("2026-10-01"),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((operation) => operation(tx));
    tx.$executeRaw.mockResolvedValue(1);
    tx.purchase.findFirst.mockResolvedValue(purchase);
    tx.purchase.delete.mockResolvedValue(purchase);
    tx.saleLine.count.mockResolvedValue(0);
    tx.payment.findFirst.mockResolvedValue(null);
    tx.inventoryTransaction.groupBy.mockResolvedValue([]);
    tx.inventoryTransaction.count.mockResolvedValue(0);
    tx.inventoryTransaction.findMany.mockResolvedValue(originals);
    tx.inventoryTransaction.createMany.mockResolvedValue({ count: 1 });
    tx.stockLot.updateMany.mockResolvedValue({ count: 1 });
    audit.logTx.mockResolvedValue(undefined);
  });

  it("carries the original line and lot identity onto the reversal and voids the lot", async () => {
    await service.remove("business-1", "purchase-1");

    const { data } = tx.inventoryTransaction.createMany.mock.calls[0][0];
    expect(data[0]).toMatchObject({ purchaseLineId: "line-1", lotId: "lot-1" });
    expect(tx.stockLot.updateMany).toHaveBeenCalledWith({
      where: { businessId: "business-1", purchaseId: "purchase-1" },
      data: { status: "VOIDED" },
    });
  });

  it("writes one negated PURCHASE_DELETE reversal per original row", async () => {
    const result = await service.remove("business-1", "purchase-1", "actor-1");

    expect(result).toEqual({ deleted: true, purchaseId: "purchase-1" });
    expect(tx.inventoryTransaction.createMany).toHaveBeenCalledTimes(1);
    const { data } = tx.inventoryTransaction.createMany.mock.calls[0][0];
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      businessId: "business-1",
      productId: "product-1",
      type: "ADJUSTMENT",
      referenceType: "PURCHASE_DELETE",
      referenceId: "purchase-1",
      unit: "kg",
      refLabel: "LOT-1",
      date: new Date("2026-10-01"),
    });
    expect(new Prisma.Decimal(data[0].qty).toFixed(3)).toBe("-10.500");
  });

  it("reads every purchase ledger type for reversal and never deletes original rows", async () => {
    await service.remove("business-1", "purchase-1");

    // PURCHASE_EDIT and PURCHASE_LINE_REVERSAL rows also belong to this purchase.
    expect(tx.inventoryTransaction.findMany).toHaveBeenCalledWith({
      where: {
        businessId: "business-1",
        referenceType: { in: ["PURCHASE", "PURCHASE_EDIT", "PURCHASE_LINE_REVERSAL"] },
        referenceId: "purchase-1",
      },
    });
    expect(tx.inventoryTransaction).not.toHaveProperty("deleteMany");
  });

  it("nets stock to zero: original plus reversal equals no change", async () => {
    await service.remove("business-1", "purchase-1");

    const { data } = tx.inventoryTransaction.createMany.mock.calls[0][0];
    const originalQty = new Prisma.Decimal("10.500");
    const reversalQty = new Prisma.Decimal(data[0].qty);
    expect(originalQty.plus(reversalQty).toFixed(3)).toBe("0.000");
  });

  it("writes an audit entry in the same transaction", async () => {
    await service.remove("business-1", "purchase-1", "actor-1");

    expect(audit.logTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        businessId: "business-1",
        actorId: "actor-1",
        action: "purchase.deleted",
        entityId: "purchase-1",
      }),
    );
  });

  it("rejects deletion when the purchase lot was sold", async () => {
    tx.saleLine.count.mockResolvedValue(1);

    await expect(service.remove("business-1", "purchase-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.inventoryTransaction.createMany).not.toHaveBeenCalled();
    expect(tx.purchase.delete).not.toHaveBeenCalled();
  });

  it("rejects deletion when supplier payments reference the purchase", async () => {
    tx.payment.findFirst.mockResolvedValueOnce({ id: "payment-1" });

    await expect(service.remove("business-1", "purchase-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.inventoryTransaction.createMany).not.toHaveBeenCalled();
    expect(tx.purchase.delete).not.toHaveBeenCalled();
  });

  it("rejects deletion when the purchase has a paid amount", async () => {
    tx.purchase.findFirst.mockResolvedValue({
      ...purchase,
      paid: new Prisma.Decimal("5"),
    });

    await expect(service.remove("business-1", "purchase-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.inventoryTransaction.createMany).not.toHaveBeenCalled();
  });

  it("rejects a second reversal when one already exists", async () => {
    tx.inventoryTransaction.count.mockResolvedValue(1);

    await expect(service.remove("business-1", "purchase-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.inventoryTransaction.createMany).not.toHaveBeenCalled();
    expect(tx.purchase.delete).not.toHaveBeenCalled();
  });

  it("returns not found for a repeated delete after the purchase is gone", async () => {
    tx.purchase.findFirst.mockResolvedValue(null);

    await expect(service.remove("business-1", "purchase-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.inventoryTransaction.createMany).not.toHaveBeenCalled();
  });

  it("scopes the lookup to the caller's business (cross-tenant safe)", async () => {
    tx.purchase.findFirst.mockResolvedValue(null);

    await expect(service.remove("business-2", "purchase-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.purchase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "purchase-1", businessId: "business-2" } }),
    );
  });

  it("propagates a write failure so the caller sees the error", async () => {
    // Mock-level only. Real atomic rollback needs a DB-backed test.
    tx.purchase.delete.mockRejectedValue(new Error("write failed"));

    await expect(service.remove("business-1", "purchase-1")).rejects.toThrow("write failed");
  });
});
describe("purchase line edit safety", () => {
  const existingLine = (over: Record<string, unknown> = {}) => ({
    id: "line-1",
    productId: "steel",
    variantId: null,
    categoryId: null,
    item: "Steel",
    attributeSnapshot: null,
    qty: new Prisma.Decimal("10"),
    unit: "kg",
    rate: new Prisma.Decimal("100"),
    sellRate: null,
    productName: null,
    spec: null,
    quality: null,
    lotNumber: null,
    heatNumber: null,
    batchNumber: null,
    warehouseId: null,
    locationId: null,
    ...over,
  });
  const requested = (over: Record<string, unknown>) =>
    ({ productId: "steel", item: "Steel", qty: 10, unit: "kg", rate: 100, ...over }) as unknown as UpdatePurchaseLineDto;

  describe("planPurchaseLineChanges", () => {
    it("matches by ID, so duplicate product and variant lines stay separate", () => {
      const plan = planPurchaseLineChanges(
        [existingLine({ id: "a" }), existingLine({ id: "b" })],
        [requested({ id: "b", qty: 7 })],
      );
      expect(plan.kept.map((k) => k.existing.id)).toEqual(["b"]);
      expect(plan.kept[0].stockChanged).toBe(true);
      expect(plan.removed.map((l) => l.id)).toEqual(["a"]);
      expect(plan.added).toHaveLength(0);
    });

    it("treats a line without an ID as an insert", () => {
      const plan = planPurchaseLineChanges([existingLine()], [requested({ qty: 3 })]);
      expect(plan.added).toHaveLength(1);
      expect(plan.kept).toHaveLength(0);
      expect(plan.removed.map((l) => l.id)).toEqual(["line-1"]);
    });

    it("marks a rate-only change as detail, not stock", () => {
      const plan = planPurchaseLineChanges([existingLine()], [requested({ id: "line-1", rate: 120 })]);
      expect(plan.kept[0].stockChanged).toBe(false);
      expect(plan.kept[0].detailChanged).toBe(true);
    });

    it("reports an unchanged resend as no change", () => {
      const plan = planPurchaseLineChanges([existingLine()], [requested({ id: "line-1" })]);
      expect(plan.kept[0].stockChanged).toBe(false);
      expect(plan.kept[0].detailChanged).toBe(false);
    });

    it("rejects a duplicate line ID in one request", () => {
      expect(() =>
        planPurchaseLineChanges(
          [existingLine()],
          [requested({ id: "line-1" }), requested({ id: "line-1" })],
        ),
      ).toThrow(BadRequestException);
    });

    it("rejects a line ID that does not belong to this purchase", () => {
      expect(() =>
        planPurchaseLineChanges([existingLine()], [requested({ id: "foreign-line" })]),
      ).toThrow(BadRequestException);
    });
  });

  describe("update path (mocked)", () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      purchase: { findFirst: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
      saleLine: { count: jest.fn() },
      payment: { findFirst: jest.fn().mockResolvedValue(null) },
      purchaseLine: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      inventoryTransaction: { createMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    };
    const prisma = {
      $transaction: jest.fn((operation: (transaction: typeof tx) => unknown) => operation(tx)),
    };
    const audit = { logTx: jest.fn() };
    const service = new PurchasesService(prisma as unknown as PrismaService, audit as never);

    beforeEach(() => {
      jest.clearAllMocks();
      tx.$executeRaw.mockResolvedValue(1);
      tx.payment.findFirst.mockResolvedValue(null);
      tx.purchase.findFirst.mockResolvedValue({
        id: "purchase-1",
        supplierId: "supplier-1",
        date: new Date("2026-10-01"),
        paid: new Prisma.Decimal("0"),
        lines: [existingLine({ id: "line-1" }), existingLine({ id: "line-2" })],
      });
      tx.purchase.update.mockResolvedValue({ id: "purchase-1", date: new Date("2026-10-01") });
      tx.purchase.findUniqueOrThrow.mockResolvedValue({ id: "purchase-1", lines: [] });
    });

    it("header-only edit on a sold purchase does not touch lines or ledger rows", async () => {
      tx.saleLine.count.mockResolvedValue(3);

      await service.update("business-1", "purchase-1", { notes: "new note" });

      expect(tx.purchase.update).toHaveBeenCalled();
      expect(tx.saleLine.count).not.toHaveBeenCalled();
      expect(tx.purchaseLine.delete).not.toHaveBeenCalled();
      expect(tx.purchaseLine.update).not.toHaveBeenCalled();
      expect(tx.purchaseLine.create).not.toHaveBeenCalled();
      expect(tx.inventoryTransaction.createMany).not.toHaveBeenCalled();
    });

    it("resending identical lines on a sold purchase is a no-op", async () => {
      tx.saleLine.count.mockResolvedValue(3);

      await service.update("business-1", "purchase-1", {
        lines: [requested({ id: "line-1" }), requested({ id: "line-2" })],
      });

      expect(tx.saleLine.count).not.toHaveBeenCalled();
      expect(tx.inventoryTransaction.createMany).not.toHaveBeenCalled();
    });

    it("a real qty change on a sold purchase is blocked by the sale guard", async () => {
      tx.saleLine.count.mockResolvedValue(3);

      await expect(
        service.update("business-1", "purchase-1", {
          lines: [requested({ id: "line-1", qty: 5 }), requested({ id: "line-2" })],
        }),
      ).rejects.toThrow("sold");
      expect(tx.inventoryTransaction.createMany).not.toHaveBeenCalled();
    });

    it("rejects a duplicate line ID before any guard or write", async () => {
      tx.saleLine.count.mockResolvedValue(3);

      await expect(
        service.update("business-1", "purchase-1", {
          lines: [requested({ id: "line-1" }), requested({ id: "line-1" })],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.saleLine.count).not.toHaveBeenCalled();
      expect(tx.purchaseLine.update).not.toHaveBeenCalled();
      expect(tx.inventoryTransaction.createMany).not.toHaveBeenCalled();
    });

    it("rejects a foreign line ID before any guard or write", async () => {
      await expect(
        service.update("business-1", "purchase-1", {
          lines: [requested({ id: "line-from-other-business" })],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.purchaseLine.delete).not.toHaveBeenCalled();
      expect(tx.inventoryTransaction.createMany).not.toHaveBeenCalled();
    });

    it("scopes the purchase lookup to the caller's business", async () => {
      tx.purchase.findFirst.mockResolvedValue(null);

      await expect(
        service.update("business-2", "purchase-1", { notes: "x" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.purchase.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "purchase-1", businessId: "business-2" } }),
      );
    });
  });
});
