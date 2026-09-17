import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { uniqueBusinessSlug } from "../common/slug";
import { sanitizeAccess } from "../common/staff-access";
import { CreateOwnerDto } from "./dto/create-owner.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

const ownerSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  loginPassword: true,
  createdAt: true,
  business: { select: { id: true, name: true, slug: true, createdAt: true } },
} as const;

const staffSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  title: true,
  access: true,
  active: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  listOwners() {
    return this.prisma.user.findMany({
      where: { role: "ADMIN" },
      select: ownerSelect,
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    });
  }

  async createOwner(dto: CreateOwnerDto) {
    await this.authService.assertEmailAvailable(dto.email);
    const passwordHash = await this.authService.hashPassword(dto.password);
    const businessName = dto.businessName.trim();
    const slug = await uniqueBusinessSlug(this.prisma, businessName);
    return this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: { name: businessName, slug },
      });
      return tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          loginPassword: dto.password,
          name: dto.name.trim(),
          role: "ADMIN",
          businessId: business.id,
        },
        select: ownerSelect,
      });
    });
  }

  async updateOwner(id: string, dto: { password?: string; active?: boolean }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Owner not found");
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Only business-owner logins can be updated");
    }
    const data: { passwordHash?: string; loginPassword?: string; active?: boolean } = {};
    if (dto.password) {
      data.passwordHash = await this.authService.hashPassword(dto.password);
      data.loginPassword = dto.password;
    }
    if (dto.active !== undefined) data.active = dto.active;
    if (!Object.keys(data).length) return this.prisma.user.findUniqueOrThrow({ where: { id }, select: ownerSelect });
    return this.prisma.user.update({
      where: { id },
      data,
      select: ownerSelect,
    });
  }

  async removeOwner(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Owner not found");
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Only business-owner logins can be revoked");
    }
    await this.prisma.user.update({
      where: { id },
      data: { active: false },
    });
  }

  listStaff(businessId: string) {
    return this.prisma.user.findMany({
      where: { businessId, role: "SUBADMIN", active: true },
      select: staffSelect,
      orderBy: { createdAt: "asc" },
    });
  }

  async createStaff(businessId: string, dto: CreateUserDto) {
    await this.authService.assertEmailAvailable(dto.email);
    const passwordHash = await this.authService.hashPassword(dto.password);
    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name.trim(),
        title: dto.title.trim(),
        role: "SUBADMIN",
        access: sanitizeAccess(dto.access),
        businessId,
      },
      select: staffSelect,
    });
  }

  async updateStaff(businessId: string, id: string, dto: UpdateUserDto) {
    const user = await this.assertStaff(businessId, id);
    const data: {
      name?: string;
      title?: string;
      access?: string[];
      passwordHash?: string;
    } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.access !== undefined) data.access = sanitizeAccess(dto.access);
    if (dto.password) data.passwordHash = await this.authService.hashPassword(dto.password);
    return this.prisma.user.update({
      where: { id: user.id },
      data,
      select: staffSelect,
    });
  }

  async removeStaff(businessId: string, id: string) {
    await this.assertStaff(businessId, id);
    await this.prisma.user.update({
      where: { id },
      data: { active: false },
    });
  }

  private async assertStaff(businessId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, businessId, role: "SUBADMIN", active: true },
    });
    if (!user) throw new NotFoundException("Staff member not found");
    return user;
  }
}
