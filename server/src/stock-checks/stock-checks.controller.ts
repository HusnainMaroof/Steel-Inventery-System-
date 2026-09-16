import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { StockChecksService } from "./stock-checks.service";
import { CreateStockCheckDto } from "./dto/create-stock-check.dto";

@Controller("stock-checks")
@UseGuards(JwtAuthGuard)
export class StockChecksController {
  constructor(private readonly stockChecksService: StockChecksService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStockCheckDto) {
    return this.stockChecksService.create(user.businessId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.stockChecksService.list(user.businessId, from, to);
  }
}
