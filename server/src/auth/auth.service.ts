import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import type { JwtPayload } from "../common/types/jwt-payload";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }
    return this.issueToken(user);
  }

  /**
   * Bootstraps the very first ADMIN together with their business.
   * Once any user exists, registration is closed — new accounts are
   * created by an ADMIN through the users module.
   */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.count();
    if (existing > 0) {
      throw new ForbiddenException("Registration is closed. Ask an admin to create your account.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        role: "ADMIN",
        business: {
          create: { name: dto.businessName },
        },
      },
    });
    return this.issueToken(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        businessId: true,
        business: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private async issueToken(user: {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "SUBADMIN";
    businessId: string;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      businessId: user.businessId,
    };
    return {
      access_token: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        businessId: user.businessId,
      },
    };
  }

  /** Used by the users module when creating staff accounts. */
  async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) throw new BadRequestException("Email is already registered");
  }

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}
