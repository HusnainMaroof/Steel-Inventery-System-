import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { ReportsService, ReportMode } from "./reports.service";

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * The full period report: stock flow, P&L, cash, business value, dues —
   * computed from transaction records so every figure is traceable.
   */
  @Get("profit")
  profit(
    @CurrentUser() user: AuthUser,
    @Query("mode") mode: ReportMode = "month",
    @Query("year") year?: string,
    @Query("month") month?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("productId") productId?: string,
  ) {
    return this.reportsService.profit(user.businessId, {
      mode,
      year: year ? Number(year) : new Date().getFullYear(),
      month: month ? Number(month) : undefined,
      from,
      to,
      productId: productId || undefined,
    });
  }
}
