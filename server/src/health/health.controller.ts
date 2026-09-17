import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Unauthenticated liveness/readiness probe for load balancers and ops.
 * Does not log successes — probes are noisy. Failures are logged in PrismaService.
 */
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  async check(): Promise<{ status: "ok"; database: "connected" }> {
    const up = await this.prisma.isReachable();
    if (!up) {
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: "Database unavailable",
        error: "Service Unavailable",
        database: "disconnected",
      });
    }
    return { status: "ok", database: "connected" };
  }
}
