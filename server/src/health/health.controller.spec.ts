import { ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  const makePrisma = (reachable: boolean) => {
    const isReachable = jest.fn().mockResolvedValue(reachable);
    const queryRaw = jest.fn();
    return {
      prisma: { isReachable, $queryRaw: queryRaw } as unknown as PrismaService,
      isReachable,
      queryRaw,
    };
  };

  describe("live", () => {
    it("returns ok without touching the database", () => {
      const { prisma, isReachable, queryRaw } = makePrisma(false);
      const controller = new HealthController(prisma);

      expect(controller.live()).toEqual({ status: "ok" });
      expect(isReachable).not.toHaveBeenCalled();
      expect(queryRaw).not.toHaveBeenCalled();
    });
  });

  describe("check (readiness)", () => {
    it("returns connected when the database answers", async () => {
      const { prisma, isReachable } = makePrisma(true);
      const controller = new HealthController(prisma);

      await expect(controller.check()).resolves.toEqual({
        status: "ok",
        database: "connected",
      });
      expect(isReachable).toHaveBeenCalledTimes(1);
    });

    it("throws 503 when the database is unreachable", async () => {
      const { prisma } = makePrisma(false);
      const controller = new HealthController(prisma);

      await expect(controller.check()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
