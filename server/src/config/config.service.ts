import { Injectable, OnModuleInit } from "@nestjs/common";

/**
 * Central configuration. Required variables are validated at startup —
 * the app refuses to boot with an incomplete environment (§20).
 */
@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly required = ["DATABASE_URL", "JWT_SECRET"] as const;

  onModuleInit(): void {
    const missing = this.required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}. ` +
          "Copy .env.example to .env and fill in the values.",
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
}
