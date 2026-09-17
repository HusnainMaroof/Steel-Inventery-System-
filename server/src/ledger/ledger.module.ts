import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { LedgerController } from "./ledger.controller";
import { LedgerService } from "./ledger.service";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [PrismaModule],
  controllers: [LedgerController, SettingsController],
  providers: [LedgerService],
})
export class LedgerModule {}
