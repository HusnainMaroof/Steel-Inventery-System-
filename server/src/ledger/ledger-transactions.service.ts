import { Injectable } from "@nestjs/common";
import { LIMITS } from "../common/security/limits";
import { CustomersService } from "../customers/customers.service";
import { ExpensesService } from "../expenses/expenses.service";
import { PaymentsService } from "../payments/payments.service";
import { PurchasesService } from "../purchases/purchases.service";
import { SalesService } from "../sales/sales.service";
import { StockChecksService } from "../stock-checks/stock-checks.service";
import { SuppliersService } from "../suppliers/suppliers.service";

/** Same hard safety cap as the old paginateAll path (200 pages × 100). */
const MAX_ROWS = 200 * LIMITS.MAX_PAGE_SIZE;

/**
 * Loads all tenant transaction collections in one API call.
 * One parallel findMany per collection — no pagination counts, because the
 * client bulk-load path reads only the row arrays (confirmed: applyTransactions
 * in client/src/lib/store.tsx consumes the seven arrays and nothing else).
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
      this.customers.listAll(businessId, MAX_ROWS),
      this.suppliers.listAll(businessId, MAX_ROWS),
      this.purchases.listAll(businessId, MAX_ROWS),
      this.sales.listAll(businessId, MAX_ROWS),
      this.payments.listAll(businessId, MAX_ROWS),
      this.expenses.listAll(businessId, MAX_ROWS),
      this.stockChecks.listAll(businessId, MAX_ROWS),
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
