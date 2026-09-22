import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { TokenVersionCache } from "./token-version-cache";
import { TokenVersionService } from "./token-version.service";
import type { JwtPayload } from "../common/types/jwt-payload";

const FUTURE = new Date("2999-01-01");

function makeUser(tokenVersion: number, subscriptionEndsAt: Date = FUTURE) {
  return {
    id: "user-1",
    access: ["sales" as const],
    tokenVersion,
    business: {
      slug: "acme",
      subscriptionStatus: "ACTIVE" as const,
      subscriptionEndsAt,
      subscriptionPlanDef: {
        billingCycle: "MONTHLY" as const,
        allowedPages: [] as string[],
      },
    },
  };
}

function makePayload(tokenVersion: number): JwtPayload {
  return {
    sub: "user-1",
    email: "owner@acme.test",
    name: "Owner",
    role: "ADMIN",
    businessId: "biz-1",
    businessSlug: "acme",
    tokenVersion,
  };
}

function build() {
  const cache = new TokenVersionCache();
  const prisma = { user: { findFirst: jest.fn() } };
  const strategy = new JwtStrategy(
    { jwtSecret: "test-secret" } as never,
    prisma as never,
    cache,
  );
  return { cache, prisma, strategy };
}

describe("JwtStrategy tokenVersion cache", () => {
  it("queries the DB on the first validate and accepts", async () => {
    const { prisma, strategy } = build();
    prisma.user.findFirst.mockResolvedValue(makeUser(5));

    const result = await strategy.validate(makePayload(5));

    expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
    expect(result.tokenVersion).toBe(5);
  });

  it("serves the second validate within TTL without a DB call", async () => {
    const { prisma, strategy } = build();
    prisma.user.findFirst.mockResolvedValue(makeUser(5));

    await strategy.validate(makePayload(5));
    const second = await strategy.validate(makePayload(5));

    expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
    expect(second.tokenVersion).toBe(5);
    expect(second.access).toEqual(["sales"]);
  });

  it("rejects a stale token immediately after a bump, before TTL expiry", async () => {
    const { cache, prisma, strategy } = build();
    prisma.user.findFirst.mockResolvedValue(makeUser(5));
    await strategy.validate(makePayload(5));

    // Logout path: TokenVersionService.bump increments and eagerly invalidates.
    const versionPrisma = { user: { update: jest.fn().mockResolvedValue({ tokenVersion: 6 }) } };
    const tokenVersions = new TokenVersionService(versionPrisma as never, cache);
    await tokenVersions.bump("user-1");

    // The DB row now carries tokenVersion 6 — findFirst honours the
    // tokenVersion filter, so a v5 JWT finds nothing.
    prisma.user.findFirst.mockImplementation(({ where }) =>
      where.tokenVersion === 6 ? Promise.resolve(makeUser(6)) : Promise.resolve(null),
    );

    await expect(strategy.validate(makePayload(5))).rejects.toThrow(
      UnauthorizedException,
    );
    // The next validate goes back to the DB and accepts the new version.
    const result = await strategy.validate(makePayload(6));
    expect(result.tokenVersion).toBe(6);
    // 1 initial + 1 rejected stale attempt (cache miss after invalidation)
    // + 1 fresh — and the fresh one re-populated the cache.
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(3);
    expect(cache.get("user-1")?.tokenVersion).toBe(6);
  });

  it("rejects a cached user whose JWT tokenVersion no longer matches", async () => {
    const { prisma, strategy } = build();
    prisma.user.findFirst.mockResolvedValue(makeUser(5));
    await strategy.validate(makePayload(5));

    await expect(strategy.validate(makePayload(4))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("expires entries after the TTL", () => {
    jest.useFakeTimers();
    const cache = new TokenVersionCache();
    cache.set("user-1", {
      tokenVersion: 1,
      businessId: "biz-1",
      role: "ADMIN",
      businessSlug: "acme",
      access: [],
      planPages: [],
      billingCycle: "MONTHLY",
      subscriptionStatus: "ACTIVE",
      subscriptionEndsAt: FUTURE,
    });
    expect(cache.get("user-1")).not.toBeNull();

    jest.advanceTimersByTime(45_001);
    expect(cache.get("user-1")).toBeNull();
    jest.useRealTimers();
  });

  it("rejects a cached user the moment the subscription window ends — no DB call", async () => {
    const { prisma, strategy } = build();
    // Plan window ends in 5 seconds.
    prisma.user.findFirst.mockResolvedValue(
      makeUser(5, new Date(Date.now() + 5_000)),
    );
    await strategy.validate(makePayload(5));
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);

    // 6 seconds pass between requests — the cached entry is still within
    // its 45s TTL, but the subscription is not.
    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + 6_000);
    await expect(strategy.validate(makePayload(5))).rejects.toThrow(
      "This business subscription has expired",
    );
    // Rejection came from the cache — still exactly one DB call.
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("invalidateBusiness drops every user of that business only", () => {
    const cache = new TokenVersionCache();
    const entry = {
      tokenVersion: 1,
      businessId: "biz-1",
      role: "ADMIN" as const,
      businessSlug: "acme",
      access: [],
      planPages: [],
      billingCycle: "MONTHLY" as const,
      subscriptionStatus: "ACTIVE" as const,
      subscriptionEndsAt: FUTURE,
    };
    cache.set("user-1", entry);
    cache.set("user-2", entry);
    cache.set("user-3", { ...entry, businessId: "biz-2" });

    cache.invalidateBusiness("biz-1");

    expect(cache.get("user-1")).toBeNull();
    expect(cache.get("user-2")).toBeNull();
    expect(cache.get("user-3")).not.toBeNull();
  });
});
