import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "./payments.service";

/**
 * The service reads the daily total, the party and its open documents in one
 * $queryRaw, then writes everything in a second one. These tests stop at the
 * read: the rules must reject before any write runs.
 */
describe("PaymentsService payment integrity", () => {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn(),
  };
  const prisma = {
    $transaction: jest.fn((operation: (transaction: typeof tx) => unknown) =>
      operation(tx),
    ),
  };
  const audit = { logTx: jest.fn() };
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    audit as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects applying one customer's payment to another customer's invoice", async () => {
    // The open-invoice read is scoped to customer A, so customer B's sale is not returned.
    tx.$queryRaw.mockResolvedValueOnce([{ dayTotal: "0", partyFound: true, open: [] }]);

    await expect(
      service.create("business-1", {
        type: "CUSTOMER",
        customerId: "customer-a",
        saleId: "sale-owned-by-customer-b",
        amount: 10,
        date: "2026-09-25",
      }),
    ).rejects.toThrow(new BadRequestException("Invoice not found for this customer"));

    // Only the read ran: no payment, allocation or audit write.
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(audit.logTx).not.toHaveBeenCalled();
  });

  it("rejects supplier payments that exceed all outstanding purchase dues", async () => {
    tx.$queryRaw.mockResolvedValueOnce([{ dayTotal: "0", partyFound: true, open: [] }]);

    await expect(
      service.create("business-1", {
        type: "SUPPLIER",
        supplierId: "supplier-1",
        amount: 10,
        date: "2026-09-25",
      }),
    ).rejects.toThrow("Supplier payment exceeds the remaining payable by 10.00");

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(audit.logTx).not.toHaveBeenCalled();
  });

  it("rejects a payment above the targeted invoice's remaining due before writing", async () => {
    tx.$queryRaw.mockResolvedValueOnce([
      {
        dayTotal: "0",
        partyFound: true,
        open: [{ saleId: "sale-1", date: "2026-09-25", invoiceId: "inv-1", total: "100.00", paid: "95.00" }],
      },
    ]);

    await expect(
      service.create("business-1", {
        type: "CUSTOMER",
        customerId: "customer-a",
        saleId: "sale-1",
        amount: 10,
        date: "2026-09-25",
      }),
    ).rejects.toThrow("Payment (10.00) exceeds the remaining due (5.00)");
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("rolls back when a guarded invoice update matched no row", async () => {
    tx.$queryRaw
      .mockResolvedValueOnce([
        {
          dayTotal: "0",
          partyFound: true,
          open: [{ saleId: "sale-1", date: "2026-09-25", invoiceId: "inv-1", total: "100.00", paid: "0.00" }],
        },
      ])
      .mockResolvedValueOnce([
        { createdAt: new Date(), invoicesUpdated: 0, purchasesUpdated: 0, allocations: 1 },
      ]);

    await expect(
      service.create("business-1", {
        type: "CUSTOMER",
        customerId: "customer-a",
        saleId: "sale-1",
        amount: 10,
        date: "2026-09-25",
      }),
    ).rejects.toThrow("Payment exceeds the remaining due on this invoice or the invoice was not found");
  });

  it("enforces the daily payment cap from the read", async () => {
    tx.$queryRaw.mockResolvedValueOnce([{ dayTotal: "499999999.00", partyFound: true, open: [] }]);

    await expect(
      service.create("business-1", {
        type: "SUPPLIER",
        supplierId: "supplier-1",
        amount: 10,
        date: "2026-09-25",
      }),
    ).rejects.toThrow("Daily payment limit");
  });
});
