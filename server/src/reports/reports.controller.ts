import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RequireStaffPage } from "../common/decorators/require-staff-page.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffAccessGuard } from "../common/guards/staff-access.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { ReportsService } from "./reports.service";
import { ProfitReportQueryDto } from "./dto/profit-report-query.dto";

@Controller("reports")
@UseGuards(JwtAuthGuard, StaffAccessGuard)
@RequireStaffPage("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * The full period report: stock flow, P&L, cash, business value, dues —
   * computed from transaction records so every figure is traceable.
   */
  @Get("profit")
  profit(@CurrentUser() user: AuthUser, @Query() query: ProfitReportQueryDto) {
    return this.reportsService.profit(user.businessId, {
      mode: query.mode,
      year: query.year ?? new Date().getFullYear(),
      month: query.month,
      from: query.from,
      to: query.to,
      productId: query.productId || undefined,
    });
  }
}
