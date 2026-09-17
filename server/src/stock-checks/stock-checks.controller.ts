import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { PaginationDto, paginate, skipTake } from "../common/dto/pagination.dto";
import { RequireStaffPage } from "../common/decorators/require-staff-page.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffAccessGuard } from "../common/guards/staff-access.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { StockChecksService } from "./stock-checks.service";
import { CreateStockCheckDto } from "./dto/create-stock-check.dto";

@Controller("stock-checks")
@UseGuards(JwtAuthGuard, StaffAccessGuard)
@RequireStaffPage("inventory")
export class StockChecksController {
  constructor(private readonly stockChecksService: StockChecksService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStockCheckDto) {
    return this.stockChecksService.create(user.businessId, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const { skip, take } = skipTake(pagination.page, pagination.limit);
    const [items, total] = await this.stockChecksService.list(
      user.businessId,
      skip,
      take,
      from,
      to,
    );
    return paginate(items, total, pagination.page, pagination.limit);
  }
}
