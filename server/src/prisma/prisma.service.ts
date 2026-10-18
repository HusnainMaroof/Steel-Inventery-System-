import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { availableParallelism } from "node:os";
import { ConfigService } from "../config/config.service";
import { redactSecrets } from "../common/database-target";

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, "error" | "warn">
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private lastActivity = 0;
  private keepWarmTimer?: NodeJS.Timeout;

  constructor(private readonly config: ConfigService) {
    super({
      adapter: new PrismaPg(PrismaService.poolConfig(config.databaseUrl)),
      log: [
        { emit: "event", level: "error" },
        { emit: "event", level: "warn" },
      ],
      // Interactive-transaction defaults. The stock-write paths (sales,
      // purchases, payments) serialize on per-product advisory locks and pay
      // WAN latency to the remote database on every query inside the tx, so
      // the 5s default timed out under as few as 5 concurrent writers
      // (Prisma error P2028 → the whole write fails and must be retried). 15s covers the observed
      // worst case (~5.1s at 5 VUs) with headroom; maxWait raised so the
      // pool doesn't reject queued transactions while others commit.
      transactionOptions: {
        maxWait: 10_000,
        timeout: 15_000,
      },
    });

    this.$on("error", (event) => {
      this.logger.error(redactSecrets(event.message));
    });
    this.$on("warn", (event) => {
      this.logger.warn(redactSecrets(event.message));
    });
  }

  // The pg adapter combines parse, bind, and execute into one network round trip.
  // Keep idle connections for five minutes so they survive the four-minute
  // keep-warm interval.
  private static poolConfig(databaseUrl: string) {
    const config = {
      connectionString: databaseUrl,
      max: availableParallelism() * 2 + 1,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 300_000,
    };

    try {
      const url = new URL(databaseUrl);
      const connectionLimit = Number(url.searchParams.get("connection_limit"));
      if (Number.isInteger(connectionLimit) && connectionLimit > 0) {
        config.max = connectionLimit;
      }
      const poolTimeoutValue = url.searchParams.get("pool_timeout");
      const poolTimeout = Number(poolTimeoutValue);
      if (
        poolTimeoutValue !== null &&
        poolTimeout >= 0 &&
        Number.isFinite(poolTimeout)
      ) {
        config.connectionTimeoutMillis = poolTimeout * 1000;
      }
    } catch {
      // Keep defaults so $connect reports invalid connection strings as usual.
    }

    return config;
  }

  async onModuleInit(): Promise<void> {
    const { host, database, pooled } = this.config.databaseTarget;
    this.logger.log(
      `database connecting host=${host} name=${database} pooled=${pooled}`,
    );
    try {
      await this.$connect();
      await this.ping();
      await this.warm();
      if (this.config.dbKeepWarmIdleMinutes > 0) {
        this.keepWarmTimer = setInterval(() => {
          if (
            Date.now() - this.lastActivity <
            this.config.dbKeepWarmIdleMinutes * 60_000
          ) {
            void this.warm();
          }
        }, this.config.dbKeepWarmIntervalSeconds * 1000);
        this.keepWarmTimer.unref();
      }
      this.logger.log(
        `database connected host=${host} name=${database} pooled=${pooled}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `database connection failed host=${host} name=${database} error=${redactSecrets(message)}`,
      );
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.keepWarmTimer) {
      clearInterval(this.keepWarmTimer);
    }
    await this.$disconnect();
    this.logger.log("database disconnected");
  }

  async isReachable(): Promise<boolean> {
    try {
      await this.ping();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `database unreachable error=${redactSecrets(message)}`,
      );
      return false;
    }
  }

  private ping(): Promise<unknown> {
    return this.$queryRaw`SELECT 1`;
  }

  async warm(): Promise<void> {
    await Promise.all(
      Array.from({ length: this.config.dbWarmConnections }, () => this.ping()),
    ).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`keep-warm ping failed error=${redactSecrets(message)}`);
    });
  }

  noteActivity(): void {
    const idleMs = this.config.dbKeepWarmIdleMinutes * 60_000;
    // idleMs 0 means keep-warm is off: never ping per request.
    if (idleMs > 0 && Date.now() - this.lastActivity > idleMs) {
      void this.warm();
    }
    this.lastActivity = Date.now();
  }
}
