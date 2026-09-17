import { Module } from "@nestjs/common";
import { OwnersController } from "./owners.controller";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { AuthModule } from "../auth/auth.module";
import { PlatformModule } from "../platform/platform.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SubscriptionModule } from "../subscription/subscription.module";

@Module({
  imports: [PrismaModule, AuthModule, PlatformModule, SubscriptionModule],
  controllers: [OwnersController, UsersController],
  providers: [UsersService],
})
export class UsersModule {}
