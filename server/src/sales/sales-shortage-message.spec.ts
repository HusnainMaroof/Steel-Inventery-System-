import { PrismaService } from "../prisma/prisma.service";
import { SalesService } from "./sales.service";
import { CreateSaleDto } from "./dto/create-sale.dto";

describe("SalesService shortage message", () => {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn(),
  };
  const prisma = {
    $transaction: jest.fn((operation: (t: typeof tx) => unknown) =>
      operation(tx),
    ),
  };
  const service = new SalesService(
    prisma as unknown as PrismaService,
    { logTx: jest.fn() } as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("counts one product once even when it appears in both variant and product shortages", async () => {
    // One product, no variants, no stock on the ledger (concurrent sales
    // consumed it). The single line lands in both variantShortages and
    // productShortages, so the message must still say 1 product, not 2.
    tx.$queryRaw.mockResolvedValue([
      {
        customerFound: true,
        productCount: 1,
        stock: [],
        categories: [],
        variants: [],
        purchaseIds: [],
        purchaseLines: [],
        consumed: [],
        lots: [],
        lotBalances: [],
      },
    ]);

    const dto = {
      date: "2026-10-18",
      customerId: "customer-1",
      lines: [
        {
          productId: "product-1",
          variantId: undefined,
          qty: 4,
          item: "Widget",
          unit: "kg",
          rate: 10,
        },
      ],
    } as unknown as CreateSaleDto;

    await expect(service.create("business-1", dto)).rejects.toThrow(
      /Insufficient inventory for 1 product\(s\)/,
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
