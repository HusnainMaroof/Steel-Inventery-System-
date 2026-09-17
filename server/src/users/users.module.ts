import { Module } from "@nestjs/common";
import { OwnersController } from "./owners.controller";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OwnersController, UsersController],
  providers: [UsersService],
})
export class UsersModule {}
