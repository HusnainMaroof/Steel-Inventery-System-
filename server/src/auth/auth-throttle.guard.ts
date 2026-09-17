import {
  HttpException,
  HttpStatus,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";

/**
 * Login/register throttle keyed by email (not IP alone) so onboarding many
 * users from one office network stays possible.
 */
import { rateLimitStore } from "../common/rate-limit/rate-limit-store";

@Injectable()
export class AuthThrottleGuard implements CanActivate {
  private readonly windowMs = 15 * 60 * 1000;

  private maxAttempts(): number {
    const env = process.env.NODE_ENV;
    if (env === "production") return 15;
    if (env === "test") return 100;
    return 60;
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      ip?: string;
      body?: { email?: string };
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const forwarded = req.headers?.["x-forwarded-for"];
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = (req.ip ?? forwardedIp ?? "unknown").split(",")[0].trim();
    const email = req.body?.email?.trim().toLowerCase();
    const key = email ? `email:${email}` : `ip:${ip}`;

    const max = this.maxAttempts();
    const count = rateLimitStore.hit(key, this.windowMs);
    if (count > max) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: "Too many attempts. Try again in a few minutes.",
          error: "Too Many Requests",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
