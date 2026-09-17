import "dotenv/config";
import {
  Logger,
  RequestMethod,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { JsonNormalizationInterceptor } from "./common/interceptors/json-normalization.interceptor";
import { redactSecrets } from "./common/database-target";
import { ConfigService } from "./config/config.service";
import { PrismaService } from "./prisma/prisma.service";

async function bootstrap() {
  if (!process.env.NODE_ENV && process.env.npm_lifecycle_event === "start:prod") {
    process.env.NODE_ENV = "production";
  }

  const logger = new Logger("Bootstrap");
  const isProduction = process.env.NODE_ENV === "production";

  try {
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({ logger: false }),
      {
        logger: isProduction
          ? ["error", "warn", "log"]
          : ["log", "error", "warn", "debug", "verbose"],
      },
    );

    app.setGlobalPrefix("api", {
      exclude: [{ path: "health", method: RequestMethod.GET }],
    });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new LoggingInterceptor(), new JsonNormalizationInterceptor());
    app.enableShutdownHooks();

    const config = app.get(ConfigService);
    app.enableCors({
      origin: config.clientOrigin,
      credentials: true,
      methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    });

    const prisma = app.get(PrismaService);
    await app.listen(config.port, "0.0.0.0");

    const { host, database, pooled } = config.databaseTarget;
    const dbUp = await prisma.isReachable();
    if (!dbUp) {
      throw new Error("database not reachable after listen");
    }

    logger.log(
      `server started port=${config.port} env=${config.nodeEnv} url=http://0.0.0.0:${config.port}/api/v1`,
    );
    logger.log(
      `database ready host=${host} name=${database} pooled=${pooled}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`server failed to start error=${redactSecrets(message)}`);
    process.exit(1);
  }
}

void bootstrap();
