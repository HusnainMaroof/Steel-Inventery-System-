import { Injectable } from "@nestjs/common";
import { paginateAll } from "../common/prisma/paginate-all";
import { CustomersService } from "../customers/customers.service";
import { ExpensesService } from "../expenses/expenses.service";
import { PaymentsService } from "../payments/payments.service";
import { PurchasesService } from "../purchases/purchases.service";
import { SalesService } from "../sales/sales.service";
import { StockChecksService } from "../stock-checks/stock-checks.service";
import { SuppliersService } from "../suppliers/suppliers.service";

/**
 * Loads all tenant transaction collections in one API call.
 * Same records as paginated list endpoints — fewer HTTP/JWT round-trips for bootstrap.
 */
@Injectable()
export class LedgerTransactionsService {
  constructor(
    private readonly customers: CustomersService,
    private readonly suppliers: SuppliersService,
    private readonly purchases: PurchasesService,
    private readonly sales: SalesService,
    private readonly payments: PaymentsService,
    private readonly expenses: ExpensesService,
    private readonly stockChecks: StockChecksService,
  ) {}

  async loadAll(businessId: string) {
    const [
      customers,
      suppliers,
      purchases,
      sales,
      payments,
      expenses,
      stockChecks,
    ] = await Promise.all([
      paginateAll((skip, take) => this.customers.list(businessId, skip, take)),
      paginateAll((skip, take) => this.suppliers.list(businessId, skip, take)),
      paginateAll((skip, take) => this.purchases.list(businessId, skip, take)),
      paginateAll((skip, take) => this.sales.list(businessId, skip, take)),
      paginateAll((skip, take) => this.payments.list(businessId, skip, take)),
      paginateAll((skip, take) => this.expenses.list(businessId, skip, take, {})),
      paginateAll((skip, take) => this.stockChecks.list(businessId, skip, take)),
    ]);

    return {
      customers,
      suppliers,
      purchases,
      sales,
      payments,
      expenses,
      stockChecks,
    };
  }
}
