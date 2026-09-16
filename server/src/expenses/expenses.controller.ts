import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { ExpensesService } from "./expenses.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { PaginationDto, paginate, skipTake } from "../common/dto/pagination.dto";

@Controller("expenses")
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(user.businessId, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query("productId") productId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const { skip, take } = skipTake(pagination.page, pagination.limit);
    const [items, total] = await this.expensesService.list(
      user.businessId,
      skip,
      take,
      { productId, from, to },
    );
    return paginate(items, total, pagination.page, pagination.limit);
  }

  @Get(":id")
  byId(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.expensesService.byId(user.businessId, id);
  }
}
