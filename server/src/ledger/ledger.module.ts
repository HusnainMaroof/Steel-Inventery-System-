import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { ExpensesModule } from "../expenses/expenses.module";
import { PaymentsModule } from "../payments/payments.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PurchasesModule } from "../purchases/purchases.module";
import { SalesModule } from "../sales/sales.module";
import { StockChecksModule } from "../stock-checks/stock-checks.module";
import { SuppliersModule } from "../suppliers/suppliers.module";
import { DashboardSummaryService } from "./dashboard-summary.service";
import { LedgerController } from "./ledger.controller";
import { LedgerService } from "./ledger.service";
import { LedgerTransactionsService } from "./ledger-transactions.service";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [
    PrismaModule,
    CustomersModule,
    SuppliersModule,
    PurchasesModule,
    SalesModule,
    PaymentsModule,
    ExpensesModule,
    StockChecksModule,
  ],
  controllers: [LedgerController, SettingsController],
  providers: [LedgerService, DashboardSummaryService, LedgerTransactionsService],
})
export class LedgerModule {}
