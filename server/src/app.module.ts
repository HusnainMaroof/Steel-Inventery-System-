import { Module } from "@nestjs/common";
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

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
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
  ],
})
export class AppModule {}
