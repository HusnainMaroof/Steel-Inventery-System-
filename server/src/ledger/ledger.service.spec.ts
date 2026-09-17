import { sanitizeUiSettings } from "../common/security/sanitize-settings";
import { PrismaService } from "../prisma/prisma.service";
import { DashboardSummaryService } from "./dashboard-summary.service";
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
  const dashboard = {
    summarize: jest.fn().mockResolvedValue({
      stockQty: 0,
      stockValue: 0,
      revenue: 0,
      customerDue: 0,
      supplierDue: 0,
      saleCount: 0,
      purchaseCount: 0,
      paymentCount: 0,
      expenseTotal: 0,
    }),
  };
  const audit = { log: jest.fn() };
  const service = new LedgerService(
    prisma as unknown as PrismaService,
    dashboard as unknown as DashboardSummaryService,
    audit as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("returns a slim bootstrap for a new business", async () => {
    prisma.$transaction.mockResolvedValue([
      [],
      [],
      [],
      [],
      [],
      [],
      [{ customers: BigInt(0), suppliers: BigInt(0), purchases: BigInt(0), sales: BigInt(0), payments: BigInt(0), expenses: BigInt(0), stockChecks: BigInt(0) }],
    ]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.business.findUniqueOrThrow.mockResolvedValue({ settings: { invoiceName: "Test" } });
    const result = await service.bootstrap("biz-a");
    expect(result).toMatchObject({
      version: 3,
      products: [],
      purchases: [],
      sales: [],
      settings: { invoiceName: "Test" },
      counts: { customers: 0, sales: 0 },
    });
    expect(dashboard.summarize).toHaveBeenCalledWith("biz-a");
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
