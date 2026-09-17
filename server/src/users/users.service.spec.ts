import { ForbiddenException } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

describe("UsersService owner revocation", () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new UsersService(
    prisma as unknown as PrismaService,
    {} as AuthService,
    { applyTemplates: jest.fn() } as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("revokes an owner without deleting the business ledger", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "owner-1",
      role: "ADMIN",
      businessId: "business-1",
    });
    prisma.user.update.mockResolvedValue({ id: "owner-1", active: false });

    await service.removeOwner("owner-1");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "owner-1" },
      data: { active: false },
    });
  });

  it("never revokes the platform Super Admin", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "super-1",
      role: "SUPERADMIN",
      businessId: "platform",
    });
    await expect(service.removeOwner("super-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
