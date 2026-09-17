import { SubscriptionStatus } from "@prisma/client";
import { IsIn, IsOptional, IsString } from "class-validator";

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsIn(["ACTIVE", "EXPIRED", "CANCELLED", "PENDING"])
  status?: SubscriptionStatus;

  /** Extend or set expiry — ISO date (yyyy-mm-dd). Ignored for lifetime plans. */
  @IsOptional()
  @IsString()
  endsAt?: string;
}
