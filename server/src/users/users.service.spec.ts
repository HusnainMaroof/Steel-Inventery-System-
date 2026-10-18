import { ForbiddenException } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

describe("UsersService owner deletion", () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const audit = { log: jest.fn(), logTx: jest.fn() };
  const service = new UsersService(
    prisma as unknown as PrismaService,
    {} as AuthService,
    { invalidateBusiness: jest.fn() } as never,
    { applyTemplates: jest.fn() } as never,
    { getById: jest.fn(), getDefaultPlan: jest.fn() } as never,
    audit as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("permanently deletes a business owner and tenant data", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "owner-1",
      role: "ADMIN",
      businessId: "business-1",
    });
    const tx = {
      paymentAllocation: { deleteMany: jest.fn() },
      payment: { deleteMany: jest.fn() },
      invoice: { deleteMany: jest.fn() },
      inventoryTransaction: { deleteMany: jest.fn() },
      sale: { deleteMany: jest.fn() },
      purchase: { deleteMany: jest.fn() },
      stockLot: { deleteMany: jest.fn() },
      stockCheck: { deleteMany: jest.fn() },
      expense: { deleteMany: jest.fn() },
      attributeDef: { deleteMany: jest.fn() },
      variant: { deleteMany: jest.fn() },
      productItem: { deleteMany: jest.fn() },
      productCategory: { deleteMany: jest.fn() },
      product: { deleteMany: jest.fn() },
      location: { deleteMany: jest.fn() },
      warehouse: { deleteMany: jest.fn() },
      supplier: { deleteMany: jest.fn() },
      customer: { deleteMany: jest.fn() },
      user: { deleteMany: jest.fn() },
      business: { delete: jest.fn() },
    };
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) =>
      fn(tx),
    );

    await service.deleteOwner("owner-1");

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.stockLot.deleteMany).toHaveBeenCalledWith({
      where: { businessId: "business-1" },
    });
    expect(audit.logTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: "owner.deleted",
        businessId: "business-1",
      }),
    );
    expect(audit.log).not.toHaveBeenCalled();
  });

  it("never deletes the platform Super Admin", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "super-1",
      role: "SUPERADMIN",
      businessId: "platform",
    });
    await expect(service.deleteOwner("super-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
