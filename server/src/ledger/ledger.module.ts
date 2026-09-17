import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { LedgerController } from "./ledger.controller";
import { DashboardSummaryService } from "./dashboard-summary.service";
import { LedgerService } from "./ledger.service";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [PrismaModule],
  controllers: [LedgerController, SettingsController],
  providers: [LedgerService, DashboardSummaryService],
})
export class LedgerModule {}
