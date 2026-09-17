import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { IsEnum, IsIn, IsOptional, IsString } from "class-validator";

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @IsOptional()
  @IsIn(["ACTIVE", "EXPIRED", "CANCELLED", "PENDING"])
  status?: SubscriptionStatus;

  /** Extend or set expiry — ISO date (yyyy-mm-dd). Ignored for LIFETIME. */
  @IsOptional()
  @IsString()
  endsAt?: string;
}
