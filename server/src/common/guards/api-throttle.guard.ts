import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { rateLimitStore } from "../rate-limit/rate-limit-store";

/**
 * Global API rate limit — in-process by default (see rate-limit-store.ts).
 * Reports endpoint has a tighter per-user limit.
 */
@Injectable()
export class ApiThrottleGuard implements CanActivate {
  private readonly windowMs = 60_000;
  private readonly maxReads = 240;
  private readonly maxWrites = 90;
  private readonly maxReportReads = 20;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      method?: string;
      ip?: string;
      url?: string;
      user?: { sub?: string; businessId?: string };
      headers?: Record<string, string | string[] | undefined>;
    }>();

    const path = req.url?.split("?")[0] ?? "";
    if (path.includes("/health") || path.includes("/auth/login") || path.includes("/auth/status")) {
      return true;
    }

    const method = (req.method ?? "GET").toUpperCase();
    const bucket = method === "GET" || method === "HEAD" ? "read" : "write";
    const isReport = path.includes("/reports/");
    const userKey = req.user?.sub ?? "anon";
    const ip = this.clientIp(req);
    const key = isReport
      ? `report:${userKey}`
      : `${ip}:${bucket}`;

    const max = isReport
      ? this.maxReportReads
      : bucket === "read"
        ? this.maxReads
        : this.maxWrites;

    const count = rateLimitStore.hit(key, this.windowMs);
    if (count > max) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: "Too many requests. Slow down and try again.",
          error: "Too Many Requests",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private clientIp(req: {
    ip?: string;
    headers?: Record<string, string | string[] | undefined>;
  }): string {
    // Only trust direct connection IP unless TRUST_PROXY=1 is set in deployment.
    if (process.env.TRUST_PROXY === "1") {
      const forwarded = req.headers?.["x-forwarded-for"];
      const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      if (forwardedIp) return forwardedIp.split(",")[0].trim();
    }
    return req.ip ?? "unknown";
  }
}
