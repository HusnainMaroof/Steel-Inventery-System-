import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SalesService } from "./sales.service";
import { CreateSaleDto } from "./dto/create-sale.dto";

describe("SalesService idempotent create", () => {
  const prisma = {
    $transaction: jest.fn(),
    sale: { findFirst: jest.fn() },
  };
  const service = new SalesService(
    prisma as unknown as PrismaService,
    { logTx: jest.fn() } as never,
  );

  const dto = (clientRequestId?: string) =>
    ({
      date: "2026-10-19",
      customerId: "customer-1",
      clientRequestId,
      lines: [{ productId: "product-1", qty: 1, item: "Widget", unit: "kg", rate: 10 }],
    }) as unknown as CreateSaleDto;

  const storedSale = {
    id: "sale-1",
    businessId: "business-1",
    clientRequestId: "6f1c2a52-6a4e-4a53-9a43-8c1f6b8d7e10",
    lines: [],
    invoice: {
      id: "invoice-1",
      number: "INV-0001",
      total: new Prisma.Decimal("10.00"),
      paid: new Prisma.Decimal("0.00"),
    },
  };

  beforeEach(() => jest.clearAllMocks());

  it("returns the first sale when a repeat with the same key fails", async () => {
    prisma.$transaction.mockRejectedValue(new Error("unique constraint"));
    prisma.sale.findFirst.mockResolvedValue(storedSale);

    const result = await service.create("business-1", dto(storedSale.clientRequestId));

    expect(prisma.sale.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: "business-1", clientRequestId: storedSale.clientRequestId },
      }),
    );
    expect(result.sale.id).toBe("sale-1");
    expect(result.invoice.total).toBe(10);
  });

  it("rethrows the original error when no sale has the key", async () => {
    const failure = new Error("Insufficient inventory");
    prisma.$transaction.mockRejectedValue(failure);
    prisma.sale.findFirst.mockResolvedValue(null);

    await expect(
      service.create("business-1", dto("0b9e3c1d-2f4a-4b6c-8d7e-9f0a1b2c3d4e")),
    ).rejects.toBe(failure);
  });

  it("does not look up a sale when the request has no key", async () => {
    const failure = new Error("Insufficient inventory");
    prisma.$transaction.mockRejectedValue(failure);

    await expect(service.create("business-1", dto())).rejects.toBe(failure);
    expect(prisma.sale.findFirst).not.toHaveBeenCalled();
  });
});
