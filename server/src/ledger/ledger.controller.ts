import { Controller, Get, UseGuards } from "@nestjs/common";
import { RequireStaffPage } from "../common/decorators/require-staff-page.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffAccessGuard } from "../common/guards/staff-access.guard";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { LedgerService } from "./ledger.service";
import { LedgerTransactionsService } from "./ledger-transactions.service";

@Controller("ledger")
@UseGuards(JwtAuthGuard, StaffAccessGuard)
@RequireStaffPage("dashboard")
export class LedgerController {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly ledgerTransactions: LedgerTransactionsService,
  ) {}

  @Get("bootstrap")
  async bootstrap(@CurrentUser() user: AuthUser) {
    return {
      data: await this.ledgerService.bootstrap(
        user.businessId,
        user.role,
        user.access,
      ),
    };
  }

  /** All transaction collections — same data as paginated list endpoints, one round-trip. */
  @Get("transactions")
  async transactions(@CurrentUser() user: AuthUser) {
    return { data: await this.ledgerTransactions.loadAll(user.businessId) };
  }
}
