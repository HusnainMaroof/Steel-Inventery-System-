import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  parseDatabaseTarget,
  type DatabaseTarget,
} from "../common/database-target";

/**
 * Central configuration. Required variables are validated at startup —
 * the app refuses to boot with an incomplete environment (§20).
 */
@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly required = [
    "DATABASE_URL",
    "DIRECT_URL",
    "JWT_SECRET",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
  ] as const;

  onModuleInit(): void {
    const missing = this.required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}. ` +
          "Copy .env.example to .env and fill in the values.",
      );
    }
    if (this.adminPassword.length < 8) {
      throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
    }
    if (this.nodeEnv === "production" && !process.env.CLIENT_ORIGIN?.trim()) {
      throw new Error(
        "CLIENT_ORIGIN is required in production (public URL of the Next.js app).",
      );
    }
  }

  get databaseUrl(): string {
    return process.env.DATABASE_URL ?? "";
  }

  get jwtSecret(): string {
    return process.env.JWT_SECRET ?? "";
  }

  get jwtExpiresIn(): string {
    return process.env.JWT_EXPIRES_IN ?? "12h";
  }

  get port(): number {
    return Number(process.env.PORT ?? 4000);
  }

  get nodeEnv(): "development" | "production" | "test" {
    const env = process.env.NODE_ENV;
    if (env === "production" || env === "test") return env;
    return "development";
  }

  get clientOrigin(): string {
    return process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
  }

  get adminEmail(): string {
    return (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  }

  get adminPassword(): string {
    return process.env.ADMIN_PASSWORD ?? "";
  }

  get databaseTarget(): DatabaseTarget {
    return parseDatabaseTarget(this.databaseUrl);
  }

  get dbWarmConnections(): number {
    const value = Number(process.env.DB_WARM_CONNECTIONS ?? 4);
    return Number.isFinite(value) ? Math.min(10, Math.max(0, Math.trunc(value))) : 4;
  }

  get dbKeepWarmIdleMinutes(): number {
    const value = Number(process.env.DB_KEEPWARM_IDLE_MINUTES ?? 20);
    return Number.isFinite(value) && value >= 0 ? value : 20;
  }

  /** Must stay below Neon's 5-minute suspend; bad values fall back to the default. */
  get dbKeepWarmIntervalSeconds(): number {
    const value = Number(process.env.DB_KEEPWARM_INTERVAL_SECONDS ?? 240);
    return Number.isFinite(value) && value >= 30 ? value : 240;
  }

  get cloudinary() {
    return {
      cloudName: (process.env.CLOUDINARY_CLOUD_NAME ?? "").trim(),
      apiKey: (process.env.CLOUDINARY_API_KEY ?? "").trim(),
      apiSecret: (process.env.CLOUDINARY_API_SECRET ?? "").trim(),
      folder: (process.env.CLOUDINARY_FOLDER ?? "tijaratt/business-logos").trim(),
    };
  }
}
