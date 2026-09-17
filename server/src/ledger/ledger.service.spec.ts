import { sanitizeUiSettings } from "../common/security/sanitize-settings";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "./ledger.service";

describe("LedgerService", () => {
  const findMany = jest.fn(() => Promise.resolve([]));
  const prisma = {
    supplier: { findMany },
    customer: { findMany },
    purchase: { findMany },
    sale: { findMany },
    payment: { findMany },
    expense: { findMany },
    stockCheck: { findMany },
    product: { findMany },
    productItem: { findMany },
    productCategory: { findMany },
    attributeDef: { findMany },
    variant: { findMany },
    warehouse: { findMany },
    $transaction: jest.fn(),
    business: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new LedgerService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it("returns a normalized empty bootstrap for a new business", async () => {
    prisma.$transaction.mockResolvedValue(Array.from({ length: 13 }, () => []));
    prisma.business.findUniqueOrThrow.mockResolvedValue({ settings: { invoiceName: "Test" } });
    const result = await service.bootstrap("biz-a");
    expect(result).toMatchObject({
      version: 2,
      products: [],
      purchases: [],
      sales: [],
      settings: { invoiceName: "Test" },
    });
    expect(prisma.supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: "biz-a" } }),
    );
  });

  it("reads preferences from the authenticated business", async () => {
    prisma.business.findUniqueOrThrow.mockResolvedValue({ settings: null });
    await expect(service.getPreferences("biz-a")).resolves.toEqual({ data: {} });
    expect(prisma.business.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "biz-a" },
      select: { settings: true },
    });
  });

  it("stores preferences on the authenticated business", async () => {
    const settings = { invoiceName: "Husna Steel" };
    const sanitized = sanitizeUiSettings(settings);
    prisma.business.update.mockResolvedValue({ settings: sanitized });
    await service.savePreferences("biz-a", settings);
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: "biz-a" },
      data: { settings: sanitized },
      select: { settings: true },
    });
  });
});
