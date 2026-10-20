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

describe("UsersService owner update", () => {
  const auth = {
    hashPassword: jest.fn(),
    assertEmailAvailable: jest.fn(),
    invalidateSessions: jest.fn(),
  };
  const tokenVersions = { invalidateBusiness: jest.fn() };
  const audit = { log: jest.fn(), logTx: jest.fn() };
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    business: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new UsersService(
    prisma as unknown as PrismaService,
    auth as unknown as AuthService,
    tokenVersions as never,
    { applyTemplates: jest.fn() } as never,
    { getById: jest.fn(), getDefaultPlan: jest.fn() } as never,
    audit as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    auth.hashPassword.mockResolvedValue("hashed");
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        user: { update: prisma.user.update },
        business: { update: prisma.business.update },
      }),
    );
  });

  const ownerSelect = {
    id: true,
    email: true,
    name: true,
    role: true,
    active: true,
    createdAt: true,
    business: {
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        subscriptionPlanId: true,
        subscriptionPlanDef: {
          select: {
            id: true,
            label: true,
            billingCycle: true,
            durationDays: true,
            allowedPages: true,
          },
        },
        subscriptionStatus: true,
        subscriptionStartsAt: true,
        subscriptionEndsAt: true,
        assignedTemplateIds: true,
        templatesAppliedAt: true,
      },
    },
  };

  it("renames business and owner in one transaction; slug untouched", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "owner-1",
      role: "ADMIN",
      email: "old@mail.com",
      name: "Old Name",
      active: true,
      businessId: "business-1",
      business: {
        id: "business-1",
        name: "Old Business",
        slug: "old-business",
        subscriptionStatus: "ACTIVE",
      },
    });
    prisma.user.update.mockResolvedValue({
      id: "owner-1",
      email: "old@mail.com",
      name: "New Name",
      role: "ADMIN",
      active: true,
      businessId: "business-1",
      business: {
        id: "business-1",
        name: "New Business",
        slug: "old-business",
        subscriptionStatus: "ACTIVE",
      },
    });

    const result = await service.updateOwner("owner-1", {
      name: "New Name",
      businessName: "New Business",
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: "business-1" },
      data: { name: "New Business" },
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "owner-1" },
        data: expect.objectContaining({ name: "New Name" }),
      }),
    );
    // slug not in business update call
    const businessUpdateCall = prisma.business.update.mock.calls[0][0];
    expect(businessUpdateCall.data).not.toHaveProperty("slug");
    expect(tokenVersions.invalidateBusiness).toHaveBeenCalledWith("business-1");
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "owner.updated", entityId: "owner-1" }),
    );
    expect(result.name).toBe("New Name");
  });

  it("lowercases and trims email; calls assertEmailAvailable for new email", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "owner-1",
      role: "ADMIN",
      email: "old@mail.com",
      name: "Owner",
      active: true,
      businessId: "business-1",
      business: {
        id: "business-1",
        name: "Business",
        slug: "business",
        subscriptionStatus: "ACTIVE",
      },
    });
    prisma.user.update.mockResolvedValue({
      id: "owner-1",
      email: "new@mail.com",
      name: "Owner",
      role: "ADMIN",
      active: true,
      businessId: "business-1",
      business: {
        id: "business-1",
        name: "Business",
        slug: "business",
        subscriptionStatus: "ACTIVE",
      },
    });

    await service.updateOwner("owner-1", { email: "  New@Mail.COM " });

    expect(auth.assertEmailAvailable).toHaveBeenCalledWith("new@mail.com");
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "owner-1" },
        data: expect.objectContaining({ email: "new@mail.com" }),
      }),
    );
  });

  it("does NOT call assertEmailAvailable when email equals current email", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "owner-1",
      role: "ADMIN",
      email: "same@mail.com",
      name: "Owner",
      active: true,
      businessId: "business-1",
      business: {
        id: "business-1",
        name: "Business",
        slug: "business",
        subscriptionStatus: "ACTIVE",
      },
    });
    prisma.user.update.mockResolvedValue({
      id: "owner-1",
      email: "same@mail.com",
      name: "Owner",
      role: "ADMIN",
      active: true,
      businessId: "business-1",
      business: {
        id: "business-1",
        name: "Business",
        slug: "business",
        subscriptionStatus: "ACTIVE",
      },
    });

    await service.updateOwner("owner-1", { email: "same@mail.com" });

    expect(auth.assertEmailAvailable).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "owner-1" },
        data: expect.objectContaining({ email: "same@mail.com" }),
      }),
    );
  });

  it("calls invalidateBusiness and writes owner.updated audit on name change", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "owner-1",
      role: "ADMIN",
      email: "owner@mail.com",
      name: "Old",
      active: true,
      businessId: "business-1",
      business: {
        id: "business-1",
        name: "Business",
        slug: "business",
        subscriptionStatus: "ACTIVE",
      },
    });
    prisma.user.update.mockResolvedValue({
      id: "owner-1",
      email: "owner@mail.com",
      name: "New",
      role: "ADMIN",
      active: true,
      businessId: "business-1",
      business: {
        id: "business-1",
        name: "Business",
        slug: "business",
        subscriptionStatus: "ACTIVE",
      },
    });

    await service.updateOwner("owner-1", { name: "New" });

    expect(tokenVersions.invalidateBusiness).toHaveBeenCalledWith("business-1");
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "owner.updated", entityId: "owner-1" }),
    );
  });

  it("password-only update keeps old behaviour (no business update, owner.password_reset audit)", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "owner-1",
      role: "ADMIN",
      email: "owner@mail.com",
      name: "Owner",
      active: true,
      businessId: "business-1",
      business: {
        id: "business-1",
        name: "Business",
        slug: "business",
        subscriptionStatus: "ACTIVE",
      },
    });
    prisma.user.update.mockResolvedValue({
      id: "owner-1",
      email: "owner@mail.com",
      name: "Owner",
      role: "ADMIN",
      active: true,
      businessId: "business-1",
      business: {
        id: "business-1",
        name: "Business",
        slug: "business",
        subscriptionStatus: "ACTIVE",
      },
    });

    await service.updateOwner("owner-1", { password: "newpass123" });

    expect(prisma.business.update).not.toHaveBeenCalled();
    expect(auth.invalidateSessions).toHaveBeenCalledWith("owner-1");
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "owner.password_reset", entityId: "owner-1" }),
    );
    expect(audit.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "owner.updated" }),
    );
  });
});
