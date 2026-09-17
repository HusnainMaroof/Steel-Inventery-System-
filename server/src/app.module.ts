import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ApiThrottleGuard } from "./common/guards/api-throttle.guard";
import { StaffAccessGuard } from "./common/guards/staff-access.guard";
import { ConfigModule } from "./config/config.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ProductsModule } from "./products/products.module";
import { InventoryModule } from "./inventory/inventory.module";
import { PurchasesModule } from "./purchases/purchases.module";
import { SalesModule } from "./sales/sales.module";
import { CustomersModule } from "./customers/customers.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { PaymentsModule } from "./payments/payments.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { StockChecksModule } from "./stock-checks/stock-checks.module";
import { ReportsModule } from "./reports/reports.module";
import { HealthModule } from "./health/health.module";
import { LedgerModule } from "./ledger/ledger.module";
import { WarehousesModule } from "./warehouses/warehouses.module";
import { PlatformModule } from "./platform/platform.module";
import { MediaModule } from "./media/media.module";
import { AuditModule } from "./common/audit/audit.module";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    InventoryModule,
    PurchasesModule,
    SalesModule,
    CustomersModule,
    SuppliersModule,
    PaymentsModule,
    InvoicesModule,
    ExpensesModule,
    StockChecksModule,
    ReportsModule,
    LedgerModule,
    WarehousesModule,
    PlatformModule,
    MediaModule,
  ],
  providers: [
    StaffAccessGuard,
    { provide: APP_GUARD, useClass: ApiThrottleGuard },
  ],
})
export class AppModule {}
