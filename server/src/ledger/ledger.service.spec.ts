import { sanitizeUiSettings } from "../common/security/sanitize-settings";
import { PrismaService } from "../prisma/prisma.service";
import { CatalogueCache } from "./catalogue-cache";
import { LedgerService } from "./ledger.service";

describe("LedgerService", () => {
  const prisma = {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    product: { findMany: jest.fn().mockResolvedValue([]) },
    productItem: { findMany: jest.fn().mockResolvedValue([]) },
    productCategory: { findMany: jest.fn().mockResolvedValue([]) },
    attributeDef: { findMany: jest.fn().mockResolvedValue([]) },
    variant: { findMany: jest.fn().mockResolvedValue([]) },
    warehouse: { findMany: jest.fn().mockResolvedValue([]) },
    business: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    user: { findMany: jest.fn() },
  };
  const audit = { log: jest.fn() };
  const catalogue = new CatalogueCache();
  const service = new LedgerService(
    prisma as unknown as PrismaService,
    audit as never,
    catalogue,
  );

  const catalogueTransactionResult = () => [
    [{ id: "prod-1", name: "Steel" }],
    [],
    [],
    [],
    [],
    [],
    { settings: { invoiceName: "Test" } },
  ];

  const zeroCounts = {
    customers: BigInt(0),
    suppliers: BigInt(0),
    purchases: BigInt(0),
    sales: BigInt(0),
    payments: BigInt(0),
    expenses: BigInt(0),
    stockChecks: BigInt(0),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    catalogue.invalidate("biz-a");
  });

  it("returns a slim bootstrap for a new business", async () => {
    prisma.$transaction.mockResolvedValue(catalogueTransactionResult());
    prisma.$queryRaw.mockResolvedValue([zeroCounts]);
    const result = await service.bootstrap("biz-a");
    expect(result).toMatchObject({
      version: 3,
      products: [{ id: "prod-1", name: "Steel" }],
      purchases: [],
      sales: [],
      settings: { invoiceName: "Test" },
      counts: { customers: 0, sales: 0 },
    });
  });

  it("serves the catalogue from cache on the second bootstrap (no catalogue transaction)", async () => {
    prisma.$transaction.mockResolvedValue(catalogueTransactionResult());
    prisma.$queryRaw.mockResolvedValue([zeroCounts]);

    await service.bootstrap("biz-a");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    await service.bootstrap("biz-a");
    // Counts still run live, but the catalogue transaction does not.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("refetches the catalogue after an invalidation", async () => {
    prisma.$transaction.mockResolvedValue(catalogueTransactionResult());
    prisma.$queryRaw.mockResolvedValue([zeroCounts]);

    await service.bootstrap("biz-a");
    catalogue.invalidate("biz-a");
    await service.bootstrap("biz-a");

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("reads preferences from the authenticated business", async () => {
    prisma.business.findUniqueOrThrow.mockResolvedValue({ settings: null });
    await expect(service.getPreferences("biz-a")).resolves.toEqual({ data: {} });
  });

  it("sanitizes settings on save", async () => {
    prisma.business.update.mockResolvedValue({ settings: { invoiceName: "Safe" } });
    await service.savePreferences("biz-a", { invoiceName: "Safe" });
    expect(prisma.business.update).toHaveBeenCalled();
    expect(sanitizeUiSettings({ invoiceName: "Safe" }).invoiceName).toBe("Safe");
  });
});
