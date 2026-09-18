import { Module } from "@nestjs/common";
import { StockChecksController } from "./stock-checks.controller";
import { StockChecksService } from "./stock-checks.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [StockChecksController],
  providers: [StockChecksService],
  exports: [StockChecksService],
})
export class StockChecksModule {}
