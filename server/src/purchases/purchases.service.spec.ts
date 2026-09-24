import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PurchasesService, replacementStockShortage } from "./purchases.service";

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
