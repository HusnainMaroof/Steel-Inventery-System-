import { Injectable } from "@nestjs/common";
import type { BillingCycle, SubscriptionStatus } from "@prisma/client";
import type { JwtPayload } from "../common/types/jwt-payload";

/**
 * In-process TTL cache in front of the per-request tokenVersion DB lookup
 * (jwt.strategy). Single-instance only — a shared store is required if the
 * API ever runs multiple instances behind a load balancer.
 *
 * Revocation semantics:
 * - Logout / password change / deactivation delete the user entry eagerly
 *   via TokenVersionService.bump — revocation is immediate.
 * - Subscription state is stored on the entry and re-evaluated against the
 *   clock on every hit, so natural expiry (subscriptionEndsAt passing) is
 *   enforced immediately, not after TTL. Admin subscription/plan changes
 *   call invalidateBusiness — also immediate. planPages/access ride the
 *   same entries.
 */
const TTL_MS = 45_000;
const MAX_ENTRIES = 10_000;

export type TokenCacheEntry = Pick<
  JwtPayload,
  "tokenVersion" | "businessId" | "role" | "businessSlug" | "access" | "planPages"
> & {
  billingCycle: BillingCycle | null;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionEndsAt: Date | null;
};

type StoredEntry = TokenCacheEntry & { expiresAt: number };

@Injectable()
export class TokenVersionCache {
  private readonly entries = new Map<string, StoredEntry>();

  get(userId: string): TokenCacheEntry | null {
    const entry = this.entries.get(userId);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(userId);
      return null;
    }
    return entry;
  }

  set(userId: string, value: TokenCacheEntry): void {
    if (this.entries.size >= MAX_ENTRIES) this.evictExpired();
    this.entries.set(userId, { ...value, expiresAt: Date.now() + TTL_MS });
  }

  /** Called on every tokenVersion bump — logout, password change, deactivation. */
  invalidate(userId: string): void {
    this.entries.delete(userId);
  }

  /** Called when a business's subscription plan/status changes. */
  invalidateBusiness(businessId: string): void {
    for (const [userId, entry] of this.entries) {
      if (entry.businessId === businessId) this.entries.delete(userId);
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
    if (this.entries.size >= MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }
}
