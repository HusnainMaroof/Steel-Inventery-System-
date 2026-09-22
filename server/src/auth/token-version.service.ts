import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TokenVersionCache } from "./token-version-cache";

@Injectable()
export class TokenVersionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: TokenVersionCache,
  ) {}

  async bump(userId: string): Promise<number> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    });
    // Eager invalidation — revocation must not wait for TTL expiry.
    this.cache.invalidate(userId);
    return user.tokenVersion;
  }

  /** Subscription/plan changes must reach every cached user of the business immediately. */
  invalidateBusiness(businessId: string): void {
    this.cache.invalidateBusiness(businessId);
  }
}
