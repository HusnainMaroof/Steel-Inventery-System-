import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { ConfigService } from "../config/config.service";
import { redactSecrets } from "../common/database-target";

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, "error" | "warn">
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly config: ConfigService) {
    super({
      log: [
        { emit: "event", level: "error" },
        { emit: "event", level: "warn" },
      ],
    });

    this.$on("error", (event) => {
      this.logger.error(redactSecrets(event.message));
    });
    this.$on("warn", (event) => {
      this.logger.warn(redactSecrets(event.message));
    });
  }

  async onModuleInit(): Promise<void> {
    const { host, database, pooled } = this.config.databaseTarget;
    this.logger.log(
      `database connecting host=${host} name=${database} pooled=${pooled}`,
    );
    try {
      await this.$connect();
      await this.ping();
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
}
