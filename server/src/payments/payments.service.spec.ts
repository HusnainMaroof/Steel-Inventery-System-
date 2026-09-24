import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "./payments.service";

describe("PaymentsService payment integrity", () => {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockResolvedValue([]),
    customer: { findFirst: jest.fn() },
    supplier: { findFirst: jest.fn() },
    sale: { findFirst: jest.fn() },
    payment: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      create: jest.fn().mockResolvedValue({ id: "payment-1" }),
    },
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
    tx.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    tx.payment.create.mockResolvedValue({ id: "payment-1" });
    tx.$queryRaw.mockResolvedValue([]);
  });

  it("rejects applying one customer's payment to another customer's invoice", async () => {
    tx.customer.findFirst.mockResolvedValue({ id: "customer-a" });
    tx.sale.findFirst.mockResolvedValue(null);

    await expect(
      service.create("business-1", {
        type: "CUSTOMER",
        customerId: "customer-a",
        saleId: "sale-owned-by-customer-b",
        amount: 10,
        date: "2026-09-25",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.sale.findFirst).toHaveBeenCalledWith({
      where: {
        id: "sale-owned-by-customer-b",
        businessId: "business-1",
        customerId: "customer-a",
      },
      select: { invoice: true },
    });
    expect(audit.logTx).not.toHaveBeenCalled();
  });

  it("rejects supplier payments that exceed all outstanding purchase dues", async () => {
    tx.supplier.findFirst.mockResolvedValue({ id: "supplier-1" });

    await expect(
      service.create("business-1", {
        type: "SUPPLIER",
        supplierId: "supplier-1",
        amount: 10,
        date: "2026-09-25",
      }),
    ).rejects.toThrow("Supplier payment exceeds the remaining payable by 10.00");

    expect(audit.logTx).not.toHaveBeenCalled();
  });
});
