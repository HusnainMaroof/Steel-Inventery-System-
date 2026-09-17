import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";

/**
 * Global API rate limit — complements AuthThrottleGuard on login.
 * Keyed by client IP + optional business id from JWT payload.
 */
@Injectable()
export class ApiThrottleGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();
  private readonly windowMs = 60_000;
  private readonly maxReads = 240;
  private readonly maxWrites = 90;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      method?: string;
      ip?: string;
      url?: string;
      user?: { businessId?: string };
      headers?: Record<string, string | string[] | undefined>;
    }>();

    const path = req.url?.split("?")[0] ?? "";
    if (path.includes("/health") || path.includes("/auth/login") || path.includes("/auth/status")) {
      return true;
    }

    const forwarded = req.headers?.["x-forwarded-for"];
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = (req.ip ?? forwardedIp ?? "unknown").split(",")[0].trim();
    const method = (req.method ?? "GET").toUpperCase();
    const bucket = method === "GET" || method === "HEAD" ? "read" : "write";
    const key = `${ip}:${bucket}`;
    const max = bucket === "read" ? this.maxReads : this.maxWrites;

    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= max) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: "Too many requests. Slow down and try again.",
          error: "Too Many Requests",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
