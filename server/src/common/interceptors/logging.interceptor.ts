import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Observable, tap } from "rxjs";

/** Structured request logging (§21) — method, url, status, duration. No bodies, no secrets. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const method = request.method;
    const url = request.url;
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log(`${method} ${url} ${Date.now() - started}ms`),
        error: (err: unknown) =>
          this.logger.warn(
            `${method} ${url} ${Date.now() - started}ms — ${
              err instanceof Error ? err.message : "error"
            }`,
          ),
      }),
    );
  }
}
