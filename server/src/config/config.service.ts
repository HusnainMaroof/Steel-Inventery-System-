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

  get cloudinary() {
    return {
      cloudName: (process.env.CLOUDINARY_CLOUD_NAME ?? "").trim(),
      apiKey: (process.env.CLOUDINARY_API_KEY ?? "").trim(),
      apiSecret: (process.env.CLOUDINARY_API_SECRET ?? "").trim(),
      folder: (process.env.CLOUDINARY_FOLDER ?? "tradex/business-logos").trim(),
    };
  }
}
