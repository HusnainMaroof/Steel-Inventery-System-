import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { SubscriptionPlansService } from "./subscription-plans.service";

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [SubscriptionPlansService],
  exports: [SubscriptionPlansService],
})
export class SubscriptionModule {}
